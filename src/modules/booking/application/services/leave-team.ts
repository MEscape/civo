import type { ActorId } from '@modules/auth';

import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceImpactUnacknowledged, resourceStale } from '../../domain/errors/booking-errors';
import { CLOSED_DAY, WEEKDAYS } from '../../domain/scheduling/weekly-hours';

import { impactAcrossPlaces } from './calendar-impact';
import { withdrawFromBookings } from './withdraw-from-bookings';

import type { CalendarReads } from './calendar-impact';
import type { CalendarChangeError } from './employee-calendar-change';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { StoredEmployee } from '../../domain/ports/team.repository';
import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { WeeklyHours } from '../../domain/scheduling/weekly-hours';
import type { Instant } from '../../domain/time/instant';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';

/** A calendar nobody works in: what leaving the team makes of it. */
const NEVER_AVAILABLE: AvailabilityPlan = {
  weekly: Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, CLOSED_DAY])) as WeeklyHours,
  exceptions: [],
};

interface Leaving {
  readonly scope: BookingScope;
  readonly employee: StoredEmployee;
  readonly location: StoredLocation;
  readonly now: Instant;
}

/**
 * Every booking of the calendar that has not begun, at every place the person is or is going to be:
 * the bookings that are open again when they leave the team (all of them, not only those a change would
 * newly leave, since from now on nobody is there).
 */
export function previewLeavingTeam(
  deps: CalendarReads,
  { scope, employee, location, now }: Leaving,
): AppResultAsync<ResourceImpactView, CalendarChangeError> {
  return impactAcrossPlaces(deps, {
    scope,
    employee,
    location,
    before: { availability: null, capacity: null, coverage: [] },
    next: { availability: NEVER_AVAILABLE, capacity: null, coverage: [] },
    now,
  });
}

/**
 * Takes a member out of their team: the calendar is switched off (calendars are never deleted, the
 * bookings it held and the history stay with it), cover is cleared, and every booking that has not
 * begun is made open again like for any other loss of the person (`withdrawFromBookings`). Refused when
 * somebody saved the calendar since it was read (`booking.resource_stale`), and when bookings are
 * affected and the manager has not seen them (`booking.resource_impact_unacknowledged`).
 */
export function leaveTeam(
  deps: CalendarReads & Pick<TeamDependencies, 'team' | 'audit' | 'bookings'>,
  request: Leaving & {
    readonly expected: Instant;
    readonly acknowledgeImpact: boolean;
    readonly actorId: ActorId;
  },
): AppResultAsync<
  { readonly saved: StoredEmployee; readonly released: number },
  CalendarChangeError
> {
  const { scope, employee, expected, now, actorId } = request;
  if (employee.updatedAt !== expected) {
    return errAsync(resourceStale());
  }
  return previewLeavingTeam(deps, request).andThen((found) => {
    if ((found.affected.length > 0 || found.isTruncated) && !request.acknowledgeImpact) {
      return errAsync(resourceImpactUnacknowledged());
    }
    return deps.team
      .save(scope, {
        stored: { ...employee, isActive: false, coverage: [] },
        expected,
        now,
      })
      .andThen((saved) =>
        withdrawFromBookings(deps, {
          scope,
          resourceId: employee.id,
          bookingIds: found.affected.map(({ bookingId }) => bookingId),
          actorId,
          now,
        }).map((released) => ({ saved, released })),
      );
  });
}
