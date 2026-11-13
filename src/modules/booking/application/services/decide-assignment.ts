import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { assessEligibility } from '../../domain/assignment/assignment-eligibility';
import {
  NO_UNIT,
  assignResource,
  findOpenUnit,
  replaceAssignment,
} from '../../domain/assignment/booking-assignment';
import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES,
  bookingConflict,
  fieldValidationFailed,
  resourceNotFound,
} from '../../domain/errors/booking-errors';
import { heldResourceIds } from '../../domain/models/booking';
import { parseBookableResourceId } from '../../domain/models/ids';

import { loadCandidates } from './assignment-candidates';

import type { BookableService, ServiceRequirement } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookableResourceId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { BookingDependencies } from '../booking-dependencies';
import type { SchedulingError } from './scheduling-context';

export type DecideAssignmentError =
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | SchedulingError
  | InfrastructureAppError;

export interface AssignmentRequest {
  readonly scope: BookingScope;
  readonly booking: Booking;
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
  readonly resourceId: BookableResourceId;
  /** Which requirement the resource fills; the first with an open unit when absent. */
  readonly requirementIndex: number | undefined;
  /** A resource already on the booking that this one replaces. */
  readonly replaces: string | undefined;
  readonly now: Instant;
}

interface Target {
  readonly requirementIndex: number;
  readonly requirement: ServiceRequirement;
}

/**
 * Which requirement an assignment is for: the one asked for, else the first with an open unit. A
 * booking with no open unit has nothing left to give, which is a conflict (someone got there first),
 * not a mistake in the request; a requirement the service does not have is the request's mistake.
 */
function targetOf(
  booking: Booking,
  requirements: readonly ServiceRequirement[],
  asked: number | undefined,
): AppResult<Target, ValidationAppError | ConflictAppError> {
  const requirementIndex =
    asked ?? requirements.findIndex((_, index) => findOpenUnit(booking, index) !== NO_UNIT);
  const requirement = requirements[requirementIndex];
  if (requirement !== undefined) {
    return ok({ requirementIndex, requirement });
  }
  return asked === undefined
    ? err(bookingConflict(CODES.alreadyAssigned, 'The booking has no open place to give.'))
    : err(fieldValidationFailed('requirementIndex', BOOKING_VALIDATION_CODES.idInvalid));
}

/** The resource to be replaced, or `null` when the request fills an open place. */
function replacedOf(
  replaces: string | undefined,
): AppResult<BookableResourceId | null, ValidationAppError> {
  return replaces === undefined ? ok(null) : parseBookableResourceId(replaces);
}

/**
 * What the booking becomes when `resourceId` is given a place on it, decided by the domain on the
 * current calendars: the resource must be active, qualified, at the location, free and working for
 * the whole booking (`assessEligibility`; `assignResource` and `replaceAssignment` accept nothing
 * else). A replacement swaps the replaced resource's unit in one step, whatever the service's
 * assignment mode (`replaceAssignment`). Nothing is written here. A resource that already holds the
 * booking changes nothing (the same booking object comes back), so repeating a request is harmless;
 * a booking with no open place is `booking.already_assigned`.
 */
export function decideAssignment(
  deps: Pick<BookingDependencies, 'bookings' | 'resources'>,
  request: AssignmentRequest,
): AppResultAsync<Booking, DecideAssignmentError> {
  const { scope, booking, service, location, resourceId, now } = request;

  if (request.replaces === undefined && heldResourceIds(booking).includes(resourceId)) {
    return okAsync(booking);
  }
  return replacedOf(request.replaces)
    .andThen((replaced) => {
      // A replacement fills the place the replaced resource holds.
      const asked =
        request.requirementIndex ??
        booking.assignments.find((unit) => replaced !== null && unit.resourceId === replaced)
          ?.requirementIndex;
      return targetOf(booking, service.requirements, asked).map((target) => ({
        ...target,
        replaced,
      }));
    })
    .asyncAndThen(({ requirementIndex, requirement, replaced }) =>
      loadCandidates(deps, { scope, booking, requirement, location, now }).andThen(
        (candidates): AppResultAsync<Booking, DecideAssignmentError> => {
          const candidate = candidates.find((found) => found.resource.id === resourceId);
          if (candidate === undefined) {
            return errAsync(resourceNotFound());
          }
          const assessment = assessEligibility({
            now,
            booking,
            requirement,
            requirementIndex,
            candidate,
          });
          if (assessment.kind === 'ineligible') {
            return errAsync(
              bookingConflict(CODES.notEligible, 'The employee cannot serve this booking.'),
            );
          }
          const decided =
            replaced === null
              ? assignResource({ booking, candidate: assessment.candidate, now })
              : replaceAssignment({ booking, replaced, candidate: assessment.candidate, now });
          return decided.asyncAndThen((assigned) => okAsync(assigned));
        },
      ),
    );
}
