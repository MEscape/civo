import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_LOCATIONS_PER_WEBSITE, MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toPublicServiceView } from '../booking-view-mappers';
import { resolvePublicScope } from '../services/public-scope';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { PublicBookingDependencies } from '../booking-dependencies';
import type { GetBookingCatalogInput } from '../contracts/booking-inputs';
import type { PublicCatalogView } from '../contracts/booking-views';
import type { PublicScopeError } from '../services/public-scope';

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
    const { services, locations } = this.deps;

    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      services
        .listByWebsite(scope.websiteId, scope.tenantId, MAX_SERVICES_PER_WEBSITE)
        .andThen((storedServices) =>
          locations
            .listByWebsite(scope.websiteId, scope.tenantId, MAX_LOCATIONS_PER_WEBSITE)
            .map((storedLocations) => this.toCatalog(input, storedServices, storedLocations)),
        ),
    );
  }

  private toCatalog(
    input: GetBookingCatalogInput,
    services: readonly BookableService[],
    locations: readonly BookingLocation[],
  ): PublicCatalogView {
    const active = locations.filter((location) => location.isActive);
    const wanted = input.serviceIds === undefined ? null : new Set(input.serviceIds);

    const offered = services
      .filter((service) => service.isActive)
      .filter((service) => wanted === null || wanted.has(service.id))
      .filter((service) => input.category === undefined || service.category === input.category)
      .map((service) => ({
        service,
        places: active.filter((location) => service.locationIds.includes(location.id)),
      }))
      .filter(({ places }) => places.length > 0);

    return {
      services: offered.map(({ service, places }) => toPublicServiceView(service, places)),
    };
  }
}
