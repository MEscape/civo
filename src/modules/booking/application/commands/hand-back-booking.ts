import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { releaseAssignment } from '../../domain/assignment/booking-assignment';
import { toEmployeeBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { findEmployeeBooking } from '../services/find-booking';
import { withinActorLimit } from '../services/limit-actor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingTargetInput } from '../contracts/booking-inputs';
import type { EmployeeBookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';

export type HandBackBookingError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * An employee gives a booking they hold back, so that it is open again. Only their own bookings are
 * reachable: the calendar is the signed-in person's, and a booking they do not hold is "not found".
 * The domain refuses it for a service whose employees are assigned at booking time, and once the
 * booking has begun (`booking.started`), the rule the day plan's button follows. The booking is
 * never cancelled by this, and the customer is not told (they have not been, when it was taken).
 */
export class HandBackBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: BookingTargetInput): AppResultAsync<EmployeeBookingView, HandBackBookingError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.claim.own', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.claimActor, actor))
      .andThen((actor) =>
        retryOnStale(() =>
          findEmployeeBooking(this.deps, actor, input.bookingId).andThen(
            ({ scope, stored, service, location, own }) =>
              releaseAssignment({ booking: stored.booking, service, resourceId: own.id, now })
                .asyncAndThen((released) =>
                  saveChange(this.deps, {
                    scope,
                    before: stored,
                    next: released,
                    now,
                    actorId: actor.id,
                  }),
                )
                .mapErr(
                  recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'assign' }),
                )
                .map((saved) => {
                  this.deps.audit.record({
                    type: 'booking.unassigned',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    actorId: actor.id,
                    bookingId: saved.booking.id,
                    serviceId: service.id,
                    resourceId: own.id,
                  });
                  return toEmployeeBookingView(saved, location.zone, scope.websiteId);
                }),
          ),
        ),
      );
  }
}
