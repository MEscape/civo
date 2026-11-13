import type { InfrastructureAppError } from '@lib/errors';
import { combineAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined, keyBy, unique } from '@lib/utils';

import { MAX_LOCATIONS_NAMED } from '../booking-limits';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { Booking } from '../../domain/models/booking';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { TimeZone } from '../../domain/time/time-zone';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { BookingLabelsView } from '../contracts/booking-views';

/** The website's locations by id: what bookings are named and timed with. */
export type LocationsById = ReadonlyMap<string, StoredLocation>;

export function loadLocations(
  deps: Pick<EmployeeAreaDependencies, 'locationAdmin'>,
  scope: BookingScope,
): AppResultAsync<LocationsById, InfrastructureAppError> {
  return deps.locationAdmin
    .list(scope, { limit: MAX_LOCATIONS_NAMED, offset: 0 })
    .map((locations) => keyBy(locations, (location) => location.id));
}

/** What the bookings of a list name besides their location: services and rooms, each read once. */
export interface BookingFacts {
  readonly services: ReadonlyMap<string, StoredService>;
  readonly resources: ReadonlyMap<string, BookableResource>;
}

export function loadBookingFacts(
  deps: Pick<EmployeeAreaDependencies, 'serviceAdmin' | 'resources'>,
  scope: BookingScope,
  bookings: readonly Booking[],
): AppResultAsync<BookingFacts, InfrastructureAppError> {
  const serviceIds = unique(bookings.map((booking) => booking.serviceId));
  const roomIds = unique(
    bookings.flatMap((booking) =>
      booking.assignments
        .filter((unit) => unit.resourceType !== 'employee')
        .map((unit) => unit.resourceId)
        .filter(isDefined),
    ),
  );
  return combineAsync(serviceIds.map((id) => deps.serviceAdmin.findById(scope, id))).andThen(
    (services) =>
      combineAsync(roomIds.map((id) => deps.resources.findById(scope, id))).map((rooms) => ({
        services: keyBy(services.filter(isDefined), (service) => service.id),
        resources: keyBy(rooms.filter(isDefined), (room) => room.id),
      })),
  );
}

/** A booking's names: its service, its location and the rooms it holds (never a person). */
export function labelsOf(
  booking: Booking,
  facts: BookingFacts,
  locations: LocationsById,
): BookingLabelsView {
  return {
    serviceName: facts.services.get(booking.serviceId)?.name ?? null,
    locationName: locations.get(booking.locationId)?.name ?? null,
    resourceNames: booking.assignments
      .filter((unit) => unit.resourceType !== 'employee' && unit.resourceId !== null)
      .map((unit) => facts.resources.get(unit.resourceId ?? '')?.name)
      .filter(isDefined),
  };
}

/**
 * The clock an employee's day is read on: their own location's, else the website's first location's;
 * `null` for a website without locations (it has no bookings either).
 */
export function homeZoneOf(
  own: BookableResource | null,
  locations: LocationsById,
): TimeZone | null {
  const homeId = own?.locationId ?? null;
  const home = homeId === null ? undefined : locations.get(homeId);
  return home?.zone ?? [...locations.values()][0]?.zone ?? null;
}
