import { conflictConstraint } from '@lib/db';
import type { ConflictAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { heldResourceIds, isLiveStatus } from '../../domain/models/booking';

import { releaseExpiredHoldsOn } from './expired-holds';
import { lockResources } from './resource-locks';
import { checkPlaces } from './resource-places';
import { checkSession } from './session-capacity';

import type {
  BookingWriteError,
  NewBooking,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { WriteScope } from '../prisma/tenant-ownership';

/** The constraints a conflicting write can name; each says what collided. */
const CONSTRAINTS = {
  reference: 'Booking_reference_key',
  id: 'Booking_pkey',
} as const;

/** Two writes that collide are told apart by the constraint the database names, never by its message. */
export function conflictOf(thrown: unknown): ConflictAppError {
  const constraint = conflictConstraint(thrown);
  if (constraint === CONSTRAINTS.reference || constraint === CONSTRAINTS.id) {
    return bookingConflict(CODES.referenceTaken, 'The booking reference is already in use.');
  }
  return bookingConflict(CODES.resourceTaken, 'A resource is already taken for that time.');
}

/** What a write transaction can come out with besides a stored booking. */
export type WriteOutcome =
  | { readonly kind: 'stored'; readonly stored: StoredBooking }
  | { readonly kind: 'refused'; readonly error: ConflictAppError };

export const refused = (
  code: typeof CODES.capacityExceeded | typeof CODES.resourceTaken | typeof CODES.bookingStale,
  message: string,
): Extract<WriteOutcome, { kind: 'refused' }> => ({
  kind: 'refused',
  error: bookingConflict(code, message),
});

/** What `reserve` answers: refused, or go ahead with the resources whose units take a place. */
export type Reservation =
  | Extract<WriteOutcome, { kind: 'refused' }>
  | { readonly kind: 'reserved'; readonly pooled: ReadonlySet<string> };

const NOTHING_HELD: Reservation = { kind: 'reserved', pooled: new Set() };

/**
 * What a live booking needs before its rows are written: the writers of its resources queued, a
 * shared session checked for places, expired holds in the way released, and the places of its
 * resources counted. A booking that is not live holds nothing and needs none of it.
 */
export async function reserve(write: WriteScope, stored: NewBooking): Promise<Reservation> {
  if (!isLiveStatus(stored.booking.status)) {
    return NOTHING_HELD;
  }
  const resourceIds = heldResourceIds(stored.booking);
  await lockResources(write, resourceIds);
  const refusal = await checkSession(write, stored);
  if (refusal === 'capacity-exceeded') {
    return refused(CODES.capacityExceeded, 'The session has no places left.');
  }
  if (refusal === 'session-split') {
    return refused(CODES.resourceTaken, 'The session is already held on other resources.');
  }
  await releaseExpiredHoldsOn(write, resourceIds, stored.booking.occupied);
  const places = await checkPlaces(write, stored);
  if (places.isFull) {
    return refused(CODES.resourceTaken, 'Every place of a resource is taken for that time.');
  }
  return { kind: 'reserved', pooled: places.pooled };
}

export function settle(outcome: WriteOutcome): AppResultAsync<StoredBooking, BookingWriteError> {
  return outcome.kind === 'stored' ? okAsync(outcome.stored) : errAsync(outcome.error);
}
