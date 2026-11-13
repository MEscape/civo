import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { releaseAssignment } from '../../domain/assignment/booking-assignment';
import { parseBookableResourceId } from '../../domain/models/ids';
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
import type { UnassignEmployeeInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';

export type UnassignEmployeeError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ValidationAppError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager takes an employee off a booking, so that its unit is open again. The domain refuses it
 * for a service whose employees are assigned at booking time (replace them instead), for a room, for
 * a resource that is not on the booking, and once the booking has begun (`booking.started`). The
 * booking itself is never cancelled by this.
 */
export class UnassignEmployee {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: UnassignEmployeeInput): AppResultAsync<BookingView, UnassignEmployeeError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        parseBookableResourceId(input.resourceId).asyncAndThen((resourceId) =>
          retryOnStale(() =>
            findBooking(this.deps, actor, input.bookingId).andThen(
              ({ scope, stored, service, location }) =>
                releaseAssignment({ booking: stored.booking, service, resourceId, now })
                  .asyncAndThen((released) =>
                    saveChange(this.deps, { scope, before: stored, next: released, now }),
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
                      resourceId,
                    });
                    return toBookingView(saved, location.zone, scope.websiteId);
                  }),
            ),
          ),
        ),
      );
  }
}
