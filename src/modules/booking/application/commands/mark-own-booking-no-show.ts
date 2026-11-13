import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { markNoShow } from '../../domain/lifecycle/booking-lifecycle';
import { toEmployeeBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { recordOwnOutcome } from '../services/own-booking-outcome';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingTargetInput } from '../contracts/booking-inputs';
import type { EmployeeBookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';

export type MarkOwnBookingNoShowError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * An employee records that nobody came to an appointment of theirs. Only their own bookings are reachable
 * (a booking they do not hold is "not found"), and the manager's rules apply: only after the
 * appointment began, and only while it is confirmed. Moving or cancelling a booking stays with the
 * managers, since that changes what the citizen was promised.
 */
export class MarkOwnBookingNoShow {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: BookingTargetInput,
  ): AppResultAsync<EmployeeBookingView, MarkOwnBookingNoShowError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.claim.own', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.claimActor, actor))
      .andThen((actor) =>
        recordOwnOutcome(this.deps, {
          actor,
          bookingId: input.bookingId,
          decide: markNoShow,
          now,
        }).map(({ scope, saved, service, location }) => {
          this.deps.audit.record({
            type: 'booking.no_show',
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            actorId: actor.id,
            bookingId: saved.booking.id,
            serviceId: service.id,
          });
          return toEmployeeBookingView(saved, location.zone, scope.websiteId);
        }),
      );
  }
}
