import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { completeBooking } from '../../domain/lifecycle/booking-lifecycle';
import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { findBooking } from '../services/find-booking';
import { withinActorLimit } from '../services/limit-actor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingTargetInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';

export type CompleteBookingError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager records that an appointment took place. The domain's rules apply: only after it began,
 * and only when someone serves it. The booking stops occupying its resources in the same write.
 */
export class CompleteBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: BookingTargetInput): AppResultAsync<BookingView, CompleteBookingError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        retryOnStale(() =>
          findBooking(this.deps, actor, input.bookingId).andThen(
            ({ scope, stored, service, location }) =>
              completeBooking(stored.booking, now)
                .asyncAndThen((done) =>
                  saveChange(this.deps, { scope, before: stored, next: done, now }),
                )
                .mapErr(
                  recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'complete' }),
                )
                .map((saved) => {
                  this.deps.audit.record({
                    type: 'booking.completed',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    actorId: actor.id,
                    bookingId: saved.booking.id,
                    serviceId: service.id,
                  });
                  return toBookingView(saved, location.zone, scope.websiteId);
                }),
          ),
        ),
      );
  }
}
