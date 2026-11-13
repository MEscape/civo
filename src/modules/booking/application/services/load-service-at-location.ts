import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound, serviceNotFound } from '../../domain/errors/booking-errors';
import { parseBookableServiceId, parseBookingLocationId } from '../../domain/models/ids';

import type { StoredService, StoredServiceLocation } from '../../domain/models/stored-service';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { ServiceAdminDependencies } from '../booking-dependencies';

/** A service as it is at one location: the shared definition, the location, and that location's part. */
export interface ServiceAtLocation {
  readonly service: StoredService;
  readonly location: StoredLocation;
  readonly setting: StoredServiceLocation;
}

export type LoadServiceError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

type Reads = Pick<ServiceAdminDependencies, 'services' | 'locations'>;

/** The location in the scope, or "not found": another website's location looks the same as a missing one. */
export function loadLocation(
  deps: Pick<Reads, 'locations'>,
  scope: BookingScope,
  rawLocationId: string,
): AppResultAsync<StoredLocation, LoadServiceError> {
  return parseBookingLocationId(rawLocationId).asyncAndThen((id) =>
    deps.locations
      .findById(scope, id)
      .andThen((location) =>
        location === null ? errAsync(locationNotFound()) : okAsync(location),
      ),
  );
}

/**
 * The service as it is at the location, or "not found": a service of another website, a service that
 * is not switched on at the location and one that does not exist all look the same.
 */
export function loadServiceAtLocation(
  deps: Reads,
  scope: BookingScope,
  raw: { readonly serviceId: string; readonly locationId: string },
): AppResultAsync<ServiceAtLocation, LoadServiceError> {
  return loadLocation(deps, scope, raw.locationId).andThen((location) =>
    parseBookableServiceId(raw.serviceId).asyncAndThen((serviceId) =>
      deps.services.findById(scope, serviceId).andThen((service) => {
        const setting = service?.locations.find((part) => part.locationId === location.id);
        return service === null || setting === undefined
          ? errAsync(serviceNotFound())
          : okAsync({ service, location, setting });
      }),
    ),
  );
}
