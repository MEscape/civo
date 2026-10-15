import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { withOfferedServices } from '../../domain/models/service-skill';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';

import type { BookingDependencies } from '../booking-dependencies';
import type { BookingOptionsView } from '../contracts/setup-views';

function distinctSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * What the screens choose from: the names of a website's locations, services
 * and resources, and nothing more. The configured entries themselves are read
 * a page at a time (`ListBookingServices` and its siblings); this stays small
 * enough to travel with every screen (the calendar's filters, the forms'
 * pickers).
 */
export class GetBookingOptions {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    BookingOptionsView,
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
                    locations: storedLocations.map((location) => ({
                      id: location.id,
                      name: location.name,
                      timeZone: location.timeZone,
                    })),
                    resources: storedResources.map((resource) => ({
                      id: resource.id,
                      name: resource.name,
                      type: resource.type,
                      locationId: resource.locationId,
                      skills: withOfferedServices(resource.skills, []),
                    })),
                    services: storedServices.map((service) => ({
                      id: service.id,
                      name: service.name,
                      horizonDays: service.horizonDays,
                    })),
                    skills: distinctSorted(
                      storedResources.flatMap((resource) =>
                        withOfferedServices(resource.skills, []),
                      ),
                    ),
                    categories: distinctSorted(
                      storedServices.flatMap((service) =>
                        service.category === null ? [] : [service.category],
                      ),
                    ),
                  })),
              ),
          ),
      ),
    );
  }
}
