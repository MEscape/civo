import type { Actor } from '@modules/auth';

import type { ConflictAppError } from '@lib/errors';
import type { AppResult, AppResultAsync } from '@lib/result';

import { findEmployeeBooking } from './find-booking';
import { recordLostRace, saveChange } from './persist-change';
import { retryOnStale } from './retry-on-stale';

import type { Booking } from '../../domain/models/booking';
import type {
  BookingScope,
  BookingWriteError,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { BookingDependencies } from '../booking-dependencies';
import type { FindBookingError, FoundBooking } from './find-booking';

/** The booking an employee changed, and what names it (for the audit trail and the view). */
export interface OwnOutcomeSaved extends Pick<FoundBooking, 'service' | 'location'> {
  readonly scope: BookingScope;
  readonly saved: StoredBooking;
}

/**
 * Applies the domain's rule for what became of an appointment (it took place, nobody came) to a booking
 * the employee holds, and saves it against the version that was read. Only their own bookings are
 * reachable (a booking they do not hold is "not found"), and a lost race is recorded and read again
 * like every other change of a booking.
 */
export function recordOwnOutcome(
  deps: BookingDependencies,
  request: {
    readonly actor: Actor;
    readonly bookingId: string;
    readonly decide: (booking: Booking, now: Instant) => AppResult<Booking, ConflictAppError>;
    readonly now: Instant;
  },
): AppResultAsync<OwnOutcomeSaved, FindBookingError | ConflictAppError | BookingWriteError> {
  const { actor, bookingId, decide, now } = request;
  return retryOnStale(() =>
    findEmployeeBooking(deps, actor, bookingId).andThen(({ scope, stored, service, location }) =>
      decide(stored.booking, now)
        .asyncAndThen((next) =>
          saveChange(deps, { scope, before: stored, next, now, actorId: actor.id }),
        )
        .mapErr(recordLostRace(deps, { scope, serviceId: service.id, stage: 'complete' }))
        .map((saved) => ({ scope, saved, service, location })),
    ),
  );
}
