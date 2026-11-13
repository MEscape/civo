import type { ActorId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { deepEqual } from '@lib/utils';

import {
  locationNotFound,
  resourceImpactUnacknowledged,
  resourceStale,
} from '../../domain/errors/booking-errors';
import { resourcePlan } from '../../domain/models/resource-availability';

import { impactAcrossPlaces } from './calendar-impact';
import { checkInsideLocation } from './parse-employee-calendar';
import { absencesOf, qualificationsOfEmployee, weekOf } from './team-views';
import { withdrawFromBookings } from './withdraw-from-bookings';

import type { CalendarReads } from './calendar-impact';
import type { ParsedCalendar } from './parse-employee-calendar';
import type { ManagerChangePart } from '../../domain/models/employee-calendar';
import type { CoverageSpell } from '../../domain/models/employee-coverage';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  LocationAdminRepository,
  StoredLocation,
} from '../../domain/ports/location-admin.repository';
import type { StoredEmployee } from '../../domain/ports/team.repository';
import type { Instant } from '../../domain/time/instant';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';

export type CalendarChangeError =
  ValidationAppError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

/** What a calendar is to become: the week and absences, and (from a manager only) the qualifications. */
export interface CalendarNext extends ParsedCalendar {
  readonly qualifications?: readonly string[] | undefined;
  /** Where the person is sent and when; absent: as it is stored (the employee's own save never sets it). */
  readonly coverage?: readonly CoverageSpell[] | undefined;
}

/** The location a calendar belongs to: its hours and its clock. */
export function locationOfEmployee(
  deps: { readonly locations: Pick<LocationAdminRepository, 'findById'> },
  scope: BookingScope,
  employee: StoredEmployee,
): AppResultAsync<StoredLocation, NotFoundAppError | InfrastructureAppError> {
  return deps.locations
    .findById(scope, employee.locationId)
    .andThen((location) => (location === null ? errAsync(locationNotFound()) : okAsync(location)));
}

/** Which parts of the calendar the change touches, in the notice's order. */
function changedParts(
  employee: StoredEmployee,
  location: StoredLocation,
  next: CalendarNext,
): ManagerChangePart[] {
  const qualifications = next.qualifications;
  return [
    ...(deepEqual(next.weekly, weekOf(employee, location)) ? [] : (['hours'] as const)),
    ...(deepEqual(next.absences, absencesOf(employee)) ? [] : (['absences'] as const)),
    ...(qualifications === undefined ||
    deepEqual([...qualifications], qualificationsOfEmployee(employee))
      ? []
      : (['qualifications'] as const)),
    ...(next.coverage === undefined || deepEqual(next.coverage, employee.coverage)
      ? []
      : (['coverage'] as const)),
  ];
}

/**
 * The bookings the new week, absences and cover would leave without the employee, that the calendar
 * as it is did not (`impactAcrossPlaces`): the same question and the same answer as for a physical
 * resource. A week outside the location's hours is refused first, at its days.
 */
export function previewCalendar(
  deps: CalendarReads,
  request: {
    readonly scope: BookingScope;
    readonly employee: StoredEmployee;
    readonly location: StoredLocation;
    readonly next: CalendarNext;
    readonly now: Instant;
  },
): AppResultAsync<ResourceImpactView, ValidationAppError | InfrastructureAppError> {
  const { scope, employee, location, next, now } = request;
  return checkInsideLocation(next.weekly, location.openingHours.weekly).asyncAndThen(() =>
    impactAcrossPlaces(deps, {
      scope,
      employee,
      location,
      before: { availability: employee.availability, capacity: null, coverage: employee.coverage },
      next: {
        availability: resourcePlan(next.weekly, next.absences),
        capacity: null,
        coverage: next.coverage ?? employee.coverage,
      },
      now,
    }),
  );
}

/**
 * Saves a change to a calendar read at `expected`: refused when somebody saved since
 * (`booking.resource_stale`), when the week leaves the location's hours, or when it leaves bookings
 * without the employee and that was not acknowledged (`booking.resource_impact_unacknowledged`).
 * Those bookings are then made open again, and nothing is cancelled or moved. A manager's change adds to the notice the employee sees; the
 * employee's own save clears it (they made it, so they have seen it).
 */
export function changeCalendar(
  deps: CalendarReads & Pick<TeamDependencies, 'team' | 'audit' | 'bookings'>,
  request: {
    readonly scope: BookingScope;
    readonly employee: StoredEmployee;
    readonly next: CalendarNext;
    readonly expected: Instant;
    readonly now: Instant;
    readonly acknowledgeImpact: boolean;
    readonly byManager: boolean;
    /** Who saves: the manager, or the employee. */
    readonly actorId: ActorId;
  },
): AppResultAsync<
  {
    readonly saved: StoredEmployee;
    readonly parts: ManagerChangePart[];
    readonly leftOpen: number;
  },
  CalendarChangeError
> {
  const { scope, employee, next, expected, now } = request;
  if (employee.updatedAt !== expected) {
    return errAsync(resourceStale());
  }
  return locationOfEmployee(deps, scope, employee).andThen((location) => {
    const parts = changedParts(employee, location, next);
    const isTimeChanged =
      parts.includes('hours') || parts.includes('absences') || parts.includes('coverage');
    const impact = isTimeChanged
      ? previewCalendar(deps, { scope, employee, location, next, now })
      : okAsync<ResourceImpactView>({ affected: [], isTruncated: false });
    return impact.andThen((found) => {
      if ((found.affected.length > 0 || found.isTruncated) && !request.acknowledgeImpact) {
        return errAsync(resourceImpactUnacknowledged());
      }
      const legacy = employee.skills.filter(
        (skill) => !qualificationsOfEmployee(employee).includes(skill),
      );
      const stored: StoredEmployee = {
        ...employee,
        availability: resourcePlan(next.weekly, next.absences),
        coverage: next.coverage ?? employee.coverage,
        skills:
          next.qualifications === undefined ? employee.skills : [...legacy, ...next.qualifications],
      };
      // The bookings the change leaves without the person are made open again, the same way for an
      // absence, new hours, cover elsewhere or leaving the team (`withdrawFromBookings`).
      // What a manager changed is told to the employee in a message; their own change tells nobody.
      const notice = request.byManager ? parts : [];
      return deps.team.save(scope, { stored, expected, now, notice }).andThen((saved) =>
        withdrawFromBookings(deps, {
          scope,
          resourceId: employee.id,
          bookingIds: found.affected.map(({ bookingId }) => bookingId),
          actorId: request.actorId,
          now,
        }).map((leftOpen) => ({ saved, parts, leftOpen })),
      );
    });
  });
}
