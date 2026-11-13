import type { ActorId } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';
import { assignmentNoticesOf } from '../../domain/models/actor-message';

import type { Booking } from '../../domain/models/booking';
import type { BookableServiceId } from '../../domain/models/ids';
import type { BookingEvent } from '../../domain/ports/booking-audit-log.port';
import type {
  BookingRepository,
  BookingScope,
  BookingWriteError,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Stores = Pick<BookingDependencies | BookingFlowDependencies, 'bookings' | 'audit'>;

/**
 * Writes the booking a rule produced, against the version it was read at. The repository does it in
 * one transaction and refuses it if the booking moved on meanwhile (`booking.stale`) or the
 * resources are taken (`booking.resource_taken`); nothing is reported as done before it returns.
 * The employees whose part in the booking changes are told in the same transaction (BD-11).
 */
export function saveChange(
  deps: { readonly bookings: Pick<BookingRepository, 'save'> },
  change: {
    readonly scope: BookingScope;
    /** The booking as it was read: its version is what the write is compared with. */
    readonly before: StoredBooking;
    readonly next: Booking;
    readonly now: Instant;
    /** An employee acting on their own booking: their own message is a record, not news. */
    readonly actorId?: ActorId;
  },
): AppResultAsync<StoredBooking, BookingWriteError> {
  const { scope, before, next, now, actorId } = change;
  return deps.bookings.save(scope, {
    stored: { ...before, booking: next },
    expected: { status: before.booking.status, updatedAt: before.booking.updatedAt },
    now,
    notices: assignmentNoticesOf(before.booking, next),
    ...(actorId === undefined ? {} : { actorId }),
  });
}

/** The codes of a write that lost to another write: worth a line in the log and the trail. */
const LOST_RACE: readonly string[] = [
  CODES.resourceTaken,
  CODES.capacityExceeded,
  CODES.bookingStale,
  CODES.referenceTaken,
];

type ConflictStage = Extract<BookingEvent, { type: 'booking.conflict_detected' }>['stage'];

/**
 * Records that a request lost to another one, then passes the error on unchanged. Used as a
 * `mapErr` step at the end of a write: the loser still gets its precise error, and operations gets
 * to see how often it happens.
 */
export function recordLostRace<E extends { readonly code: string }>(
  deps: Pick<Stores, 'audit'>,
  lost: {
    readonly scope: BookingScope;
    readonly serviceId: BookableServiceId;
    readonly stage: ConflictStage;
  },
): (error: E) => E {
  const { scope, serviceId, stage } = lost;
  return (error) => {
    if (LOST_RACE.includes(error.code)) {
      deps.audit.record({
        type: 'booking.conflict_detected',
        tenantId: scope.tenantId,
        websiteId: scope.websiteId,
        serviceId,
        stage,
        errorCode: error.code,
      });
    }
    return error;
  };
}
