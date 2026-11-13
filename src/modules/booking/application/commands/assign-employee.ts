import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseBookableResourceId } from '../../domain/models/ids';
import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { decideAssignment } from '../services/decide-assignment';
import { findBooking } from '../services/find-booking';
import { withinActorLimit } from '../services/limit-actor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { AssignEmployeeInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';
import type { SchedulingError } from '../services/scheduling-context';

export type AssignEmployeeError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ValidationAppError
  | NotFoundAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager gives a unit of a booking to a resource (an employee), or moves it from one employee to
 * another (`replaces`). Who may serve is decided by the domain on the current calendars
 * (`decideAssignment`). The change and the booking's new version are written in one transaction, and
 * if the employee was taken at the same moment by another booking the database refuses it
 * (`booking.resource_taken`) and nothing is written. Replacing works for every assignment mode, an
 * `automatic` one included, because the unit changes hands in one step; it ends when the booking
 * begins (`booking.started`).
 *
 * Safe to repeat: giving a booking to the employee who already has it changes nothing and records
 * nothing.
 */
export class AssignEmployee {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: AssignEmployeeInput): AppResultAsync<BookingView, AssignEmployeeError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        parseBookableResourceId(input.resourceId).asyncAndThen((resourceId) =>
          retryOnStale(() =>
            findBooking(this.deps, actor, input.bookingId).andThen(
              ({ scope, stored, service, location }) =>
                decideAssignment(this.deps, {
                  scope,
                  booking: stored.booking,
                  service,
                  location,
                  resourceId,
                  requirementIndex: input.requirementIndex,
                  replaces: input.replaces,
                  now,
                })
                  .andThen((assigned) =>
                    assigned === stored.booking
                      ? okAsync({ saved: stored, isChange: false })
                      : saveChange(this.deps, { scope, before: stored, next: assigned, now }).map(
                          (saved) => ({
                            saved,
                            isChange: true,
                          }),
                        ),
                  )
                  .mapErr(
                    recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'assign' }),
                  )
                  .map(({ saved, isChange }) => {
                    if (isChange) {
                      this.deps.audit.record({
                        type: 'booking.assigned',
                        tenantId: scope.tenantId,
                        websiteId: scope.websiteId,
                        actorId: actor.id,
                        bookingId: saved.booking.id,
                        serviceId: service.id,
                        resourceId,
                        how: 'assign',
                      });
                    }
                    return toBookingView(saved, location.zone, scope.websiteId);
                  }),
            ),
          ),
        ),
      );
  }
}
