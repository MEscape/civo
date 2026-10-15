import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { assessServiceFeasibility } from '../../domain/scheduling/service-feasibility';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';
import { toPublicServiceView } from '../booking-view-mappers';
import { resolvePublicScope } from '../services/public-scope';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { PublicBookingDependencies } from '../booking-dependencies';
import type { GetBookingCatalogInput } from '../contracts/booking-inputs';
import type { PublicCatalogView } from '../contracts/catalog-views';
import type { PublicScopeError } from '../services/public-scope';

/**
 * The places a visitor can really book a service: the active locations that
 * offer it where every requirement can be filled today. A service whose
 * employees have not offered it yet, or that has nothing to serve it, is not
 * shown there, so a visitor is never led to a time that cannot exist. The
 * managers see the same service marked as waiting in the setup.
 */
function bookablePlaces(
  service: BookableService,
  active: readonly BookingLocation[],
  resources: readonly BookableResource[],
): readonly BookingLocation[] {
  const readiness = new Map(
    assessServiceFeasibility({ service, locations: active, resources }).locations.map((entry) => [
      entry.locationId,
      entry.readiness,
    ]),
  );
  return active.filter(
    (location) =>
      service.locationIds.includes(location.id) && readiness.get(location.id) === 'ready',
  );
}

/**
 * What a website offers its visitors: its active services and the active
 * locations each is offered at. Contains no personal data and no internal
 * configuration (resource requirements, buffers, staff policy).
 *
 * @authorization public Lists what the website offers its visitors; every website is public by its identity.
 */
export class GetBookingCatalog {
  constructor(private readonly deps: PublicBookingDependencies) {}

  execute(
    input: GetBookingCatalogInput,
  ): AppResultAsync<PublicCatalogView, PublicScopeError | InfrastructureAppError> {
    const { services, locations, resources } = this.deps;

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      services
        .listByWebsite(scope.websiteId, scope.tenantId, MAX_SERVICES_PER_WEBSITE)
        .andThen((storedServices) =>
          locations
            .listByWebsite(scope.websiteId, scope.tenantId, MAX_LOCATIONS_PER_WEBSITE)
            .andThen((storedLocations) =>
              resources
                .listByWebsite(scope.websiteId, scope.tenantId, MAX_RESOURCES_PER_WEBSITE)
                .map((storedResources) =>
                  this.toCatalog(input, {
                    services: storedServices,
                    locations: storedLocations,
                    resources: storedResources,
                  }),
                ),
            ),
        ),
    );
  }

  private toCatalog(
    input: GetBookingCatalogInput,
    stored: {
      readonly services: readonly BookableService[];
      readonly locations: readonly BookingLocation[];
      readonly resources: readonly BookableResource[];
    },
  ): PublicCatalogView {
    const { services, locations, resources } = stored;
    const active = locations.filter((location) => location.isActive);
    const wanted = input.serviceIds === undefined ? null : new Set(input.serviceIds);

    const offered = services
      .filter((service) => service.isActive)
      .filter((service) => wanted === null || wanted.has(service.id))
      .filter((service) => input.category === undefined || service.category === input.category)
      .map((service) => ({
        service,
        places: bookablePlaces(service, active, resources),
      }))
      .filter(({ places }) => places.length > 0);

    return {
      services: offered.map(({ service, places }) => toPublicServiceView(service, places)),
    };
  }
}
