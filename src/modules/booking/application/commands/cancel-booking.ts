import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { cancelBooking } from '../../domain/lifecycle/booking-lifecycle';
import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
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

export type CancelBookingError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager cancels a booking or a hold. The service's policy still has its say (cancelling may be
 * switched off, or reserved for other actors), but the customer's deadline does not bind a manager.
 * The customer is told after the write returned. Safe to repeat: the second call finds the booking
 * already cancelled and answers with the rule's error, changing nothing.
 */
export class CancelBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: BookingTargetInput): AppResultAsync<BookingView, CancelBookingError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        retryOnStale(() =>
          findBooking(this.deps, actor, input.bookingId).andThen(
            ({ scope, stored, service, location }) =>
              cancelBooking({ booking: stored.booking, service, actor: 'manager', now })
                .asyncAndThen((cancelled) =>
                  saveChange(this.deps, { scope, before: stored, next: cancelled, now }),
                )
                .mapErr(
                  recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'cancel' }),
                )
                .map((saved) => {
                  this.deps.audit.record({
                    type: 'booking.cancelled',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    actorId: actor.id,
                    bookingId: saved.booking.id,
                    serviceId: service.id,
                    by: 'manager',
                  });
                  announce(this.deps, {
                    kind: 'cancelled',
                    stored: saved,
                    location,
                    websiteId: scope.websiteId,
                  });
                  return toBookingView(saved, location.zone, scope.websiteId);
                }),
          ),
        ),
      );
  }
}
