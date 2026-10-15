import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { servesLocation } from '../../domain/models/bookable-resource';
import { parseWebsiteId } from '../../domain/models/ids';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';

import type { BookingDependencies } from '../booking-dependencies';
import type { SetupOverviewView } from '../contracts/setup-views';

/**
 * The first screen of the setup: every location of the website with what it
 * holds, so a person sees where they stand (is it open, does it offer
 * anything, has it rooms) before opening one. Employees have calendars of
 * their own and are not counted as resources of a place.
 */
export class GetSetupOverview {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    SetupOverviewView,
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
                      address: location.address,
                      isActive: location.isActive,
                      isOpen: Object.values(location.openingHours.weekly).some(
                        (day) => day.intervals.length > 0,
                      ),
                      serviceCount: storedServices.filter((service) =>
                        service.locationIds.includes(location.id),
                      ).length,
                      resourceCount: storedResources.filter(
                        (resource) =>
                          resource.type !== 'employee' && servesLocation(resource, location.id),
                      ).length,
                    })),
                  })),
              ),
          ),
      ),
    );
  }
}
