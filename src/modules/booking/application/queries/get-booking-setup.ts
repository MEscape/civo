import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_LOCATIONS_NAMED, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';
import { loadLocationNames } from '../services/service-names';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';
import type { BookingSetupView } from '../contracts/service-views';

export type GetBookingSetupError = BookingAccessError;

/**
 * How far the booking setup of the named website has come, for the screens that tell a first-time
 * manager what to do next: a location, then services, resources and the team. Reading is enough to
 * see it (`booking.read`); acting on it needs `booking.configure`, which every control asks again.
 */
export class GetBookingSetup {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: WebsiteTargetInput): AppResultAsync<BookingSetupView, GetBookingSetupError> {
    const { access, services, resources } = this.deps;

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return ResultAsync.combine([
        loadLocationNames(this.deps, scope),
        services.listNames(scope, SERVICE_LIMITS.listMax),
        resources.list(scope, { limit: MAX_RESOURCES_PER_WEBSITE }),
      ] as const).map(([locations, named, listed]): BookingSetupView => {
        const team = listed.filter((resource) => resource.type === 'employee' && resource.isActive);
        return {
          locations: locations.size,
          services: named.services.length,
          resources: listed.filter((resource) => resource.type !== 'employee').length,
          team: team.length,
          locationChoices: [...locations]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          isTruncated:
            named.isTruncated ||
            locations.size >= MAX_LOCATIONS_NAMED ||
            listed.length >= MAX_RESOURCES_PER_WEBSITE,
        };
      });
    });
  }
}
