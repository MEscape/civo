import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';
import { employeeHoursOf } from '../../domain/models/booking-location';
import { parseWebsiteId } from '../../domain/models/ids';
import { offeredServiceIdsOf } from '../../domain/models/service-skill';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';
import { toLocationView, toResourceView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { TeamView } from '../contracts/setup-views';

/**
 * The employees of a website with their working hours, for those who manage
 * the bookings: who works where and when, next to the week their location is
 * open. An employee's calendar is theirs (they set it up themselves), but the
 * people who run the bookings need to see it, and to set it when asked.
 */
export class GetTeam {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<TeamView, AuthorizationError | ValidationAppError | InfrastructureAppError> {
    const { authorization, locations, resources, services } = this.deps;

    return authorization.requireInTenant('booking.manage').andThen((actor) =>
      parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        locations
          .listByWebsite(websiteId, actor.tenantId, MAX_LOCATIONS_PER_WEBSITE)
          .andThen((storedLocations) =>
            resources
              .listByWebsite(websiteId, actor.tenantId, MAX_RESOURCES_PER_WEBSITE)
              .andThen((storedResources) =>
                services
                  .listByWebsite(websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
                  .map((storedServices) => ({ storedResources, storedServices })),
              )
              .map(({ storedResources, storedServices }) => ({
                members: storedResources
                  .filter((resource) => resource.type === 'employee')
                  .map((resource) => {
                    const view = toResourceView(resource);
                    return {
                      id: view.id,
                      name: view.name,
                      locationId: view.locationId,
                      availability: view.availability,
                      isActive: view.isActive,
                      offeredServiceIds: offeredServiceIdsOf(view.skills),
                    };
                  }),
                locations: storedLocations.map((location) => {
                  const view = toLocationView(location);
                  return {
                    id: view.id,
                    name: view.name,
                    openingHours: view.openingHours,
                    staffHours: view.staffHours,
                    employeeHours: toAvailabilityPlanInput(employeeHoursOf(location)),
                  };
                }),
                services: storedServices
                  .filter((service) => service.isActive)
                  .map((service) => ({
                    id: service.id,
                    name: service.name,
                    locationIds: service.locationIds,
                  })),
              })),
          ),
      ),
    );
  }
}
