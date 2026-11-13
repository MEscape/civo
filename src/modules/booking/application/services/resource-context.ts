import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound } from '../../domain/errors/booking-errors';
import { addLocalDays } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/local-time-resolution';
import { localDateOf } from '../../domain/time/time-zone';
import { MAX_BLOCKING_BOOKINGS_PER_QUERY } from '../booking-limits';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';

import type { ResourceContext } from './resource-views';
import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { ResourceAdminDependencies } from '../booking-dependencies';

/**
 * What every view of a location's resources is drawn from: the location (its clock and hours), the
 * services that use its resources, and the bookings that hold anything there today. Another
 * website's location is "not found".
 */
export function loadResourceContext(
  deps: Pick<ResourceAdminDependencies, 'locations' | 'resources' | 'bookings'>,
  request: {
    readonly scope: BookingScope;
    readonly locationId: BookingLocationId;
    readonly now: Instant;
  },
): AppResultAsync<ResourceContext, NotFoundAppError | InfrastructureAppError> {
  const { scope, locationId, now } = request;
  return deps.locations.findById(scope, locationId).andThen((location) => {
    if (location === null) {
      return errAsync(locationNotFound());
    }
    const today = localDateOf(now, location.zone);
    const span = {
      start: startOfLocalDay(today, location.zone),
      end: startOfLocalDay(addLocalDays(today, 1), location.zone),
    };
    return deps.resources
      .listUsers(scope, location.id, SERVICE_LIMITS.listMax)
      .andThen(({ users, isTruncated }) =>
        // Past the bound, today is drawn from a cut list and shows less use than there is; the view says so.
        deps.bookings
          .listBlocking(scope, { span, now, limit: MAX_BLOCKING_BOOKINGS_PER_QUERY })
          .map(({ bookings }) => ({
            location,
            users,
            isUsersTruncated: isTruncated,
            today: bookings.map(({ booking }) => booking),
            now,
          })),
      );
  });
}
