import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';
import { toLocationView, toResourceView, toServiceView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { BookingSetupView } from '../contracts/setup-views';

/** Everything an administrator configures for a website: its locations, resources and services. */
export class GetBookingSetup {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    BookingSetupView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, locations, resources, services } = this.deps;

    return authorization.requireInTenant('booking.read').andThen((actor) =>
      parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        locations
          .listByWebsite(websiteId, actor.tenantId, MAX_LOCATIONS_PER_WEBSITE)
          .andThen((storedLocations) =>
            resources
              .listByWebsite(websiteId, actor.tenantId, MAX_RESOURCES_PER_WEBSITE)
              .andThen((storedResources) =>
                services
                  .listByWebsite(websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
                  .map((storedServices) => ({
                    locations: storedLocations.map(toLocationView),
                    resources: storedResources.map(toResourceView),
                    services: storedServices.map(toServiceView),
                  })),
              ),
          ),
      ),
    );
  }
}
