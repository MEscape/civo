import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { assessCandidates } from '../../domain/assignment/assignment-eligibility';
import { rankCandidates } from '../../domain/assignment/assignment-ranking';
import { NO_UNIT, findOpenUnit } from '../../domain/assignment/booking-assignment';
import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { toFitView } from '../booking-view-mappers';
import { loadCandidates } from '../services/assignment-candidates';
import { currentInstant } from '../services/clock-instant';
import { findBooking } from '../services/find-booking';

import type { ServiceRequirement } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingDependencies } from '../booking-dependencies';
import type { GetAssignmentCandidatesInput } from '../contracts/booking-inputs';
import type { AssignmentCandidatesView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { SchedulingError } from '../services/scheduling-context';

export type GetAssignmentCandidatesError =
  | BookingAccessError
  | FindBookingError
  | ValidationAppError
  | SchedulingError
  | InfrastructureAppError;

/** The requirement asked for, else the first with an open unit, else the first. */
function requirementOf(
  booking: Booking,
  requirements: readonly ServiceRequirement[],
  asked: number | undefined,
): AppResult<
  { readonly index: number; readonly requirement: ServiceRequirement },
  ValidationAppError
> {
  const open = requirements.findIndex((_, index) => findOpenUnit(booking, index) !== NO_UNIT);
  const index = asked ?? Math.max(open, 0);
  const requirement = requirements[index];
  return requirement === undefined
    ? err(fieldValidationFailed('requirementIndex', BOOKING_VALIDATION_CODES.idInvalid))
    : ok({ index, requirement });
}

/**
 * Who can fill a requirement of a booking, for the manager's assignment dialog: the resources that
 * pass the domain's eligibility rules on the current calendars, best fit first, and the ones that
 * do not with every reason (overlaps another booking, lacks a qualification, ...). Preferences only
 * order the list (each employee's saved ones); they never add or remove anyone.
 */
export class GetAssignmentCandidates {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: GetAssignmentCandidatesInput,
  ): AppResultAsync<AssignmentCandidatesView, GetAssignmentCandidatesError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => findBooking(this.deps, actor, input.bookingId))
      .andThen(({ scope, stored, service, location }) =>
        requirementOf(stored.booking, service.requirements, input.requirementIndex).asyncAndThen(
          ({ index, requirement }) =>
            loadCandidates(this.deps, {
              scope,
              booking: stored.booking,
              requirement,
              location,
              now,
            }).andThen((candidates) => {
              const { eligible, ineligible } = assessCandidates({
                now,
                booking: stored.booking,
                requirement,
                requirementIndex: index,
                candidates,
              });
              const people = eligible.map(({ resource }) => resource.id);
              return this.deps.preferences
                .findMany(scope, people)
                .map((preferences): AssignmentCandidatesView => {
                  const ranked = rankCandidates({
                    candidates: eligible,
                    preferences,
                    subject: {
                      serviceId: stored.booking.serviceId,
                      appointment: { start: stored.booking.start, end: stored.booking.end },
                      zone: location.zone,
                    },
                  });
                  return {
                    requirementIndex: index,
                    eligible: ranked.map(({ candidate, fit }) => ({
                      resourceId: candidate.resource.id,
                      fit: toFitView(fit),
                    })),
                    unavailable: ineligible.map(({ resourceId, reasons }) => ({
                      resourceId,
                      reasons,
                    })),
                  };
                });
            }),
        ),
      );
  }
}
