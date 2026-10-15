import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { hasBookings, locationNotEmpty, serviceOnlyHere } from '../../domain/errors/booking-errors';
import { MAX_RESOURCES_PER_WEBSITE, MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toServiceView } from '../booking-view-mappers';
import { loadAuthorizedLocation } from '../load-authorized-location';
import { replaceService } from '../services/replace-service';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingDependencies } from '../booking-dependencies';
import type { LoadLocationError } from '../load-authorized-location';

type DeleteLocationError =
  | LoadLocationError
  | ConflictAppError
  | ValidationAppError
  | NotFoundAppError
  | InfrastructureAppError;

/**
 * Removes a location that was never booked and that holds nothing: no room,
 * no equipment, no employee is placed there, and no service is offered only
 * here. Services that are offered at other places too simply stop being offered
 * here. Everything is checked before anything is changed, and the location
 * itself goes last, so a refusal leaves the setup as it was.
 */
export class DeleteBookingLocation {
  constructor(private readonly deps: BookingDependencies) {}

  execute(locationId: string): AppResultAsync<void, DeleteLocationError> {
    const { bookings, locations, resources, services, audit } = this.deps;

    return loadAuthorizedLocation(this.deps, locationId, 'booking.configure').andThen(
      ({ actor, location }) =>
        bookings
          .isReferenced({ kind: 'location', id: location.id }, actor.tenantId)
          .andThen((isReferenced) => (isReferenced ? errAsync(hasBookings()) : okAsync(undefined)))
          .andThen(() =>
            resources.listByWebsite(location.websiteId, actor.tenantId, MAX_RESOURCES_PER_WEBSITE),
          )
          .andThen((stored) =>
            stored.some((resource) => resource.locationId === location.id)
              ? errAsync(locationNotEmpty())
              : okAsync(undefined),
          )
          .andThen(() =>
            services.listByWebsite(location.websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE),
          )
          .andThen((stored) => {
            const offeredHere = stored.filter((service) =>
              service.locationIds.includes(location.id),
            );
            return offeredHere.some((service) => service.locationIds.length === 1)
              ? errAsync(serviceOnlyHere())
              : okAsync(offeredHere);
          })
          .andThen((offeredHere) =>
            offeredHere.reduce<AppResultAsync<undefined, DeleteLocationError>>(
              (previous, service) =>
                previous.andThen(() => this.stopOffering(actor, service, location.id)),
              okAsync(undefined),
            ),
          )
          .andThen(() => locations.deleteById(location.id, actor.tenantId))
          .map(() => {
            audit.record({
              type: 'booking.location_deleted',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: location.websiteId,
              locationId: location.id,
            });
          }),
    );
  }

  private stopOffering(
    actor: Parameters<typeof replaceService>[1]['actor'],
    service: BookableService,
    locationId: string,
  ): AppResultAsync<undefined, DeleteLocationError> {
    return replaceService(
      this.deps,
      { actor, service },
      {
        ...toServiceView(service),
        locationIds: service.locationIds.filter((id) => id !== locationId),
      },
    ).map(() => undefined);
  }
}
