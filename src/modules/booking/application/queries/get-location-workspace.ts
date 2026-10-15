import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { servesLocation } from '../../domain/models/bookable-resource';
import { assessServiceFeasibility } from '../../domain/scheduling/service-feasibility';
import { MAX_RESOURCES_PER_WEBSITE, MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toLocationView, toResourceView, toServiceView } from '../booking-view-mappers';
import { loadAuthorizedLocation } from '../load-authorized-location';

import type { BookingDependencies } from '../booking-dependencies';
import type { LocationWorkspaceView } from '../contracts/setup-views';
import type { LoadLocationError } from '../load-authorized-location';

/**
 * Everything the workspace of one location shows: the place with its opening
 * hours, the services offered there (each with whether it can be booked yet),
 * the rooms and equipment that can serve it, and the services of the website
 * that are not offered here and could be added. The services' readiness comes
 * from the same domain rule the booking uses, for this location alone.
 */
export class GetLocationWorkspace {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawLocationId: string,
  ): AppResultAsync<
    LocationWorkspaceView,
    | LoadLocationError
    | AuthorizationError
    | ValidationAppError
    | NotFoundAppError
    | InfrastructureAppError
  > {
    const { resources, services } = this.deps;

    return loadAuthorizedLocation(this.deps, rawLocationId, 'booking.read').andThen(
      ({ actor, location }) =>
        resources
          .listByWebsite(location.websiteId, actor.tenantId, MAX_RESOURCES_PER_WEBSITE)
          .andThen((storedResources) =>
            services
              .listByWebsite(location.websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
              .map((storedServices) => {
                const offeredHere = storedServices.filter((service) =>
                  service.locationIds.includes(location.id),
                );
                return {
                  location: toLocationView(location),
                  services: offeredHere.map((service) => ({
                    service: toServiceView(service),
                    readiness:
                      assessServiceFeasibility({
                        service,
                        locations: [location],
                        resources: storedResources,
                      }).locations[0]?.readiness ?? 'blocked',
                  })),
                  resources: storedResources
                    .filter(
                      (resource) =>
                        resource.type !== 'employee' && servesLocation(resource, location.id),
                    )
                    .map(toResourceView),
                  otherServices: storedServices
                    .filter((service) => !service.locationIds.includes(location.id))
                    .map(toServiceView),
                };
              }),
          ),
    );
  }
}
