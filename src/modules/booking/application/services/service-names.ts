import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_LOCATIONS_NAMED } from '../booking-limits';

import type { ServiceOrigin } from '../../domain/models/service-origin';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { TimeZone } from '../../domain/time/time-zone';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { LocationNameView, ServiceOriginView } from '../contracts/service-views';

/** What every location of the website is called, by id: what origins and "shared with" are written with. */
export type LocationNames = ReadonlyMap<string, string>;

export function loadLocationNames(
  deps: Pick<ServiceAdminDependencies, 'locations'>,
  scope: BookingScope,
): AppResultAsync<LocationNames, InfrastructureAppError> {
  return deps.locations
    .list(scope, { limit: MAX_LOCATIONS_NAMED, offset: 0 })
    .map((locations) => new Map(locations.map((location) => [location.id, location.name])));
}

export function nameView(id: string, names: LocationNames): LocationNameView | null {
  const name = names.get(id);
  return name === undefined ? null : { id, name };
}

/** How a service came to be at a location, with the name of the place it points to. */
export function toOriginView(origin: ServiceOrigin, names: LocationNames): ServiceOriginView {
  switch (origin.kind) {
    case 'own':
      return { kind: 'own' };
    case 'copy':
      return { kind: 'copy', from: nameView(origin.fromLocationId, names) };
    case 'linked':
      return { kind: 'linked', from: nameView(origin.homeLocationId, names) };
  }
}

/** What zone each location of the website keeps time in: a booking is shown on its own location's clock. */
export function loadLocationZones(
  deps: Pick<ServiceAdminDependencies, 'locations'>,
  scope: BookingScope,
): AppResultAsync<ReadonlyMap<string, TimeZone>, InfrastructureAppError> {
  return deps.locations
    .list(scope, { limit: MAX_LOCATIONS_NAMED, offset: 0 })
    .map((locations) => new Map(locations.map((location) => [location.id, location.zone])));
}

/** The locations of the website by id, whole: what a booking needs to be announced on its own clock. */
export function loadLocationsById(
  deps: Pick<ServiceAdminDependencies, 'locations'>,
  scope: BookingScope,
): AppResultAsync<ReadonlyMap<string, StoredLocation>, InfrastructureAppError> {
  return deps.locations
    .list(scope, { limit: MAX_LOCATIONS_NAMED, offset: 0 })
    .map((locations) => new Map(locations.map((location) => [location.id, location])));
}
