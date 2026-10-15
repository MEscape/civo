import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';
import { employeeHoursOf } from '../../domain/models/booking-location';
import { parseWebsiteId } from '../../domain/models/ids';
import { offeredServiceIdsOf } from '../../domain/models/service-skill';
import { MAX_LOCATIONS_PER_WEBSITE, MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toResourceView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { OwnProfileView } from '../contracts/setup-views';

/**
 * What an employee needs to set up their own calendar: the calendar that is
 * theirs, and the active services and the locations they can choose from.
 * The calendar is selected by the person in the store; the lists are the
 * website's public offer, names only.
 */
export class GetOwnProfile {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    OwnProfileView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, resources, services, locations } = this.deps;

    return authorization.requireInTenant('booking.read.own').andThen((actor) => {
      const parsed = parseWebsiteId(rawWebsiteId);
      if (parsed.isErr()) {
        return errAsync(parsed.error);
      }
      const scope = { websiteId: parsed.value, tenantId: actor.tenantId };

      return resources.listAssignedTo(scope, actor.id, 1).andThen(([own]) =>
        services
          .listByWebsite(scope.websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
          .andThen((storedServices) =>
            locations
              .listByWebsite(scope.websiteId, actor.tenantId, MAX_LOCATIONS_PER_WEBSITE)
              .map((storedLocations) => ({
                profile: own === undefined ? null : toResourceView(own),
                offeredServiceIds: offeredServiceIdsOf(own?.skills ?? []),
                services: storedServices
                  .filter((service) => service.isActive)
                  .map((service) => ({
                    id: service.id,
                    name: service.name,
                    locationIds: service.locationIds,
                  })),
                locations: storedLocations
                  .filter((location) => location.isActive)
                  .map((location) => ({
                    id: location.id,
                    name: location.name,
                    timeZone: location.timeZone,
                    employeeHours: toAvailabilityPlanInput(employeeHoursOf(location)),
                  })),
              })),
          ),
      );
    });
  }
}
