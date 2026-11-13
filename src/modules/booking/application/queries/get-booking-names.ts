import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { formatLocalDate } from '../../domain/time/local-date';
import { localDateOf } from '../../domain/time/time-zone';
import { MAX_RESOURCES_PER_WEBSITE, MAX_SERVICES_NAMED } from '../booking-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { loadLocations } from '../services/employee-labels';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';
import type { BookingNamesView } from '../contracts/booking-views';

export type GetBookingNamesError = BookingAccessError | InfrastructureAppError;

const byName = <T extends { readonly name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

/**
 * What the website's locations, services and resources (employees included) are called: the one
 * read a manager's list, side panel and calendar label bookings with, since their views carry ids
 * only. Three bounded statements, each pinned to the signed-in person's tenant and website. Employee
 * names are what managers already see in the team, so the permission is `booking.read`.
 */
export class GetBookingNames {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: WebsiteTargetInput): AppResultAsync<BookingNamesView, GetBookingNamesError> {
    const now = currentInstant(this.deps.clock);
    return this.deps.access
      .authorizeWebsite('booking.read', input.websiteId)
      .andThen(({ actor }) => {
        const scope = scopeOfActor(actor);
        return loadLocations(this.deps, scope).andThen((locations) =>
          this.deps.serviceAdmin.listNames(scope, MAX_SERVICES_NAMED).andThen((named) =>
            this.deps.resources
              .list(scope, { limit: MAX_RESOURCES_PER_WEBSITE })
              .map((resources): BookingNamesView => ({
                locations: [...locations.values()]
                  .map(({ id, name, zone }) => ({
                    id,
                    name,
                    timeZone: zone,
                    today: formatLocalDate(localDateOf(now, zone)),
                  }))
                  .sort(byName),
                services: named.services.map(({ id, name }) => ({ id, name })),
                isServicesTruncated: named.isTruncated,
                resources: resources.map(({ id, name, type }) => ({ id, name, type })).sort(byName),
              })),
          ),
        );
      });
  }
}
