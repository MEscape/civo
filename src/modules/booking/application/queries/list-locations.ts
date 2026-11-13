import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage, offsetOf, resolvePageRequest, toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { LOCATION_PAGE_LIMITS } from '../booking-limits';
import { LOCATION_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { toLocationSummary } from '../services/location-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { LocationListQuery } from '../../domain/ports/location-admin.repository';
import type { LocationAdminDependencies } from '../booking-dependencies';
import type { ListLocationsInput } from '../contracts/location-inputs';
import type { LocationPageView } from '../contracts/location-views';

export type ListLocationsError = BookingAccessError | InfrastructureAppError;

/**
 * The locations of the website, a page at a time, for the people who look after them. Filtering,
 * counting and paging are the database's, and "open today" is read on each location's own clock, so
 * a location in another zone is judged by its own day. Needs `booking.read`.
 */
export class ListLocations {
  constructor(private readonly deps: LocationAdminDependencies) {}

  execute(input: ListLocationsInput): AppResultAsync<LocationPageView, ListLocationsError> {
    const { access, locations, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      const requested = resolvePageRequest(input.page, LOCATION_PAGE_LIMITS);
      const search = input.search?.trim().slice(0, LOCATION_LIMITS.searchMax);
      const query = (request: PageRequest): LocationListQuery => ({
        search,
        isActive: input.isActive,
        limit: request.pageSize,
        offset: offsetOf(request),
      });

      return loadClampedPage(requested, (request) =>
        locations
          .count(scope, query(request))
          .andThen((total) =>
            locations.list(scope, query(request)).map((items) => toPage(items, total, request)),
          ),
      ).map((page) => ({
        items: page.items.map((location) => toLocationSummary(location, now)),
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        pageCount: page.pageCount,
      }));
    });
  }
}
