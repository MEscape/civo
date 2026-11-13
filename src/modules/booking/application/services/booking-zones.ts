import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { keyBy, unique } from '@lib/utils';

import { locationNotFound } from '../../domain/errors/booking-errors';

import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';

/**
 * The locations the given bookings are at, each read once: a view draws every booking on the clock
 * of its own location (BD-02), and a list can span several. Bounded by the number of locations of
 * the website, not by the number of bookings.
 */
export function locationsOfBookings(
  deps: Pick<BookingDependencies, 'locations'>,
  scope: BookingScope,
  bookings: readonly StoredBooking[],
): AppResultAsync<
  ReadonlyMap<BookingLocationId, BookingLocationFacts>,
  NotFoundAppError | InfrastructureAppError
> {
  const ids = unique(bookings.map(({ booking }) => booking.locationId));
  return combineAsync(
    ids.map((id) =>
      deps.locations
        .findById(scope, id)
        .andThen((location): AppResultAsync<BookingLocationFacts, NotFoundAppError> =>
          location === null ? errAsync(locationNotFound()) : okAsync(location),
        ),
    ),
  ).map((locations) => keyBy(locations, (location) => location.id));
}
