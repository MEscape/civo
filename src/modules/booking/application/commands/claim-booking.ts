import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { assessEligibility } from '../../domain/assignment/assignment-eligibility';
import { assignResource } from '../../domain/assignment/booking-assignment';
import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { heldResourceIds, hasOpenUnits } from '../../domain/models/booking';
import { mayEmployeeClaim } from '../../domain/policies/service-policy';
import { toEmployeeBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { daysOf } from '../services/assignment-candidates';
import { loadBlocking } from '../services/blocking-reads';
import { currentInstant } from '../services/clock-instant';
import { findBooking } from '../services/find-booking';
import { withinActorLimit } from '../services/limit-actor';
import { recordLostRace, saveChange } from '../services/persist-change';
import { retryOnStale } from '../services/retry-on-stale';
import { scheduleOf, windowAround } from '../services/scheduling-context';

import type { Booking } from '../../domain/models/booking';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingTargetInput } from '../contracts/booking-inputs';
import type { EmployeeBookingView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { ActorLimitError } from '../services/limit-actor';
import type { SchedulingError } from '../services/scheduling-context';

export type ClaimBookingError =
  | BookingAccessError
  | ActorLimitError
  | FindBookingError
  | ValidationAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * An employee takes an open booking. Who is claiming comes from the session, never from the request:
 * the calendar that takes the booking is the one that belongs to the signed-in person. The booking
 * must be of a service whose bookings are claimed, and the employee must be able to serve it by the
 * domain's rules (qualified, at the location, free and working for the whole of it). If someone else
 * took it first the answer is `booking.already_assigned`, never a silent success; if two claims
 * arrive together exactly one is written (the other finds the booking changed, reads it again and
 * gets that answer).
 *
 * Safe to repeat: an employee who already holds the booking gets it back unchanged, with no second
 * write.
 */
export class ClaimBooking {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: BookingTargetInput): AppResultAsync<EmployeeBookingView, ClaimBookingError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.claim.own', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.claimActor, actor))
      .andThen((actor) =>
        retryOnStale(() =>
          findBooking(this.deps, actor, input.bookingId).andThen(
            ({ scope, stored, service, location }) =>
              this.deps.resources.findEmployeeOf(scope, actor.id).andThen((own) => {
                const { booking } = stored;
                const view = (next: typeof stored) =>
                  toEmployeeBookingView(next, location.zone, scope.websiteId);
                if (own === null) {
                  return errAsync(
                    bookingConflict(CODES.notEligible, 'You have no calendar to take it on.'),
                  );
                }
                if (heldResourceIds(booking).includes(own.id)) {
                  return okAsync(view(stored));
                }
                if (!mayEmployeeClaim(service)) {
                  return errAsync(
                    bookingConflict(CODES.notClaimable, 'This booking is assigned by a manager.'),
                  );
                }
                if (!hasOpenUnits(booking)) {
                  return errAsync(
                    bookingConflict(CODES.alreadyAssigned, 'The booking has already been taken.'),
                  );
                }
                const window = windowAround(daysOf(booking, location));
                return loadBlocking(this.deps, {
                  scope,
                  location,
                  window,
                  now,
                  resourceIds: [own.id],
                  except: [booking.id],
                })
                  .andThen((blocking): AppResultAsync<Booking, ClaimBookingError> => {
                    const candidate = {
                      resource: own,
                      schedule: scheduleOf(own, { location, window, blocking }),
                    };
                    const eligible = service.requirements
                      .map((requirement, requirementIndex) =>
                        assessEligibility({
                          now,
                          booking,
                          requirement,
                          requirementIndex,
                          candidate,
                        }),
                      )
                      .find((assessment) => assessment.kind === 'eligible');
                    return eligible?.kind === 'eligible'
                      ? assignResource({
                          booking,
                          candidate: eligible.candidate,
                          now,
                        }).asyncAndThen((claimed) => okAsync(claimed))
                      : errAsync(
                          bookingConflict(CODES.notEligible, 'You cannot serve this booking.'),
                        );
                  })
                  .andThen((claimed) =>
                    saveChange(this.deps, {
                      scope,
                      before: stored,
                      next: claimed,
                      now,
                      actorId: actor.id,
                    }),
                  )
                  .mapErr(
                    recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'assign' }),
                  )
                  .map((saved) => {
                    this.deps.audit.record({
                      type: 'booking.assigned',
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      actorId: actor.id,
                      bookingId: saved.booking.id,
                      serviceId: service.id,
                      resourceId: own.id,
                      how: 'claim',
                    });
                    return view(saved);
                  });
              }),
          ),
        ),
      );
  }
}
