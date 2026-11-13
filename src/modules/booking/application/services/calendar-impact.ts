import type { InfrastructureAppError } from '@lib/errors';
import { combineAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { findResourceImpact } from './resource-impact';

import type { ResourceUse } from './resource-impact';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  LocationAdminRepository,
  StoredLocation,
} from '../../domain/ports/location-admin.repository';
import type { StoredEmployee } from '../../domain/ports/team.repository';
import type { Instant } from '../../domain/time/instant';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';

/** What the rules for a calendar read: the bookings that would be left without the person, and the locations they are at. */
export interface CalendarReads {
  readonly bookings: Pick<TeamDependencies['bookings'], 'list'>;
  readonly locations: Pick<LocationAdminRepository, 'findById'>;
}

/**
 * The bookings a change would leave without the employee, that they were not already without, asked
 * once for every place the person is, or is going to be, used: their own location and each one they are
 * sent to, now or after the change. `before` and `next` say when and where the person is available; for
 * leaving the team `before` is "as available as the place" and `next` is never, so every booking counts.
 */
export function impactAcrossPlaces(
  deps: CalendarReads,
  request: {
    readonly scope: BookingScope;
    readonly employee: StoredEmployee;
    /** The person's own location. */
    readonly location: StoredLocation;
    readonly before: ResourceUse;
    readonly next: ResourceUse;
    readonly now: Instant;
  },
): AppResultAsync<ResourceImpactView, InfrastructureAppError> {
  const { scope, employee, location, before, next, now } = request;
  const places = unique([
    employee.locationId,
    ...(before.coverage ?? []).map((spell) => spell.locationId),
    ...(next.coverage ?? []).map((spell) => spell.locationId),
  ]);
  const impactAt = (place: StoredLocation | null) =>
    place === null
      ? okAsync<ResourceImpactView>({ affected: [], isTruncated: false })
      : findResourceImpact(deps, {
          scope,
          location: place,
          resource: { id: employee.id, type: 'employee', ...before },
          next,
          placed: { home: employee.locationId },
          now,
        });
  return combineAsync(
    places.map((id) =>
      id === location.id
        ? impactAt(location)
        : deps.locations.findById(scope, id).andThen(impactAt),
    ),
  ).map((found) => ({
    affected: found.flatMap((impact) => impact.affected),
    isTruncated: found.some((impact) => impact.isTruncated),
  }));
}
