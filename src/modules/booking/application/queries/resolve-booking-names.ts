import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync, parseValidIds } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  parseBookableResourceId,
  parseBookableServiceId,
  parseBookingId,
  parseBookingLocationId,
  parseWebsiteId,
} from '../../domain/models/ids';
import { MAX_RESOLVED_NAMES } from '../booking-limits';

import type { NameLookupDependencies } from '../booking-dependencies';
import type { BookingNamesView, ResolveBookingNamesInput } from '../contracts/name-views';

/**
 * The names of some services, locations and resources of a website, and the
 * references of some of its bookings, so a screen that keeps only their ids
 * (the audit log) can name them. Whoever may read every booking may ask; no
 * customer data is read. An id that names nothing of the website (deleted,
 * another website's) is absent. One read per kind, none for a kind not asked.
 */
export class ResolveBookingNames {
  constructor(private readonly deps: NameLookupDependencies) {}

  execute(
    rawWebsiteId: string,
    input: ResolveBookingNamesInput,
  ): AppResultAsync<
    BookingNamesView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, services, locations, resources, bookings } = this.deps;
    const serviceIds = parseValidIds(input.serviceIds, parseBookableServiceId, MAX_RESOLVED_NAMES);
    const locationIds = parseValidIds(
      input.locationIds,
      parseBookingLocationId,
      MAX_RESOLVED_NAMES,
    );
    const resourceIds = parseValidIds(
      input.resourceIds,
      parseBookableResourceId,
      MAX_RESOLVED_NAMES,
    );
    const bookingIds = parseValidIds(input.bookingIds, parseBookingId, MAX_RESOLVED_NAMES);

    return authorization.requireInTenant('booking.read').andThen((actor) =>
      parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        ResultAsync.combine([
          services.findNames(websiteId, actor.tenantId, serviceIds),
          locations.findNames(websiteId, actor.tenantId, locationIds),
          resources.findNames(websiteId, actor.tenantId, resourceIds),
          bookings.findReferences({ websiteId, tenantId: actor.tenantId }, bookingIds),
        ] as const).map(([namedServices, namedLocations, namedResources, referenced]) => ({
          services: namedServices,
          locations: namedLocations,
          resources: namedResources,
          bookings: referenced.map(({ id, reference }) => ({ id, name: reference })),
        })),
      ),
    );
  }
}
