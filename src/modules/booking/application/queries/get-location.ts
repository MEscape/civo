import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound } from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { countFutureBookings } from '../services/location-impact';
import { toLocationView } from '../services/location-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { LocationAdminDependencies } from '../booking-dependencies';
import type { GetLocationInput } from '../contracts/location-inputs';
import type { LocationView } from '../contracts/location-views';

export type GetLocationError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * One location with its hours in the shape a form edits, the version a change must name, and how
 * many confirmed bookings it still has ahead. A location of another website is "not found". Needs
 * `booking.read`.
 */
export class GetLocation {
  constructor(private readonly deps: LocationAdminDependencies) {}

  execute(input: GetLocationInput): AppResultAsync<LocationView, GetLocationError> {
    const { access, locations, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookingLocationId(input.locationId).asyncAndThen((id) =>
        locations
          .findById(scope, id)
          .andThen((location) =>
            location === null
              ? errAsync(locationNotFound())
              : countFutureBookings(this.deps, { scope, locationId: location.id, now }).map(
                  (count) => toLocationView(location, scope.websiteId, count),
                ),
          ),
      );
    });
  }
}
