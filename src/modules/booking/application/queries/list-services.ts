import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';
import { loadLocation } from '../services/load-service-at-location';
import { pageOfServices, readFilters } from '../services/service-list-grouping';
import { loadLocationNames } from '../services/service-names';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ListServicesInput } from '../contracts/service-inputs';
import type { ServicePageView } from '../contracts/service-views';

export type ListServicesError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The services switched on at one location, grouped by category and paged by category, narrowed by
 * a name, a category, where each came from and whether it is running. Filtering, grouping and paging
 * are done here on the location's services, which are bounded when read. Needs `booking.read`.
 */
export class ListServices {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: ListServicesInput): AppResultAsync<ServicePageView, ListServicesError> {
    const { access, services } = this.deps;

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return loadLocation(this.deps, scope, input.locationId).andThen((location) =>
        services.listAtLocation(scope, location.id, SERVICE_LIMITS.listMax).andThen((listing) =>
          loadLocationNames(this.deps, scope).map((names) =>
            pageOfServices({
              location,
              entries: listing.entries,
              isTruncated: listing.isTruncated,
              filters: readFilters(input),
              names,
              input,
            }),
          ),
        ),
      );
    });
  }
}
