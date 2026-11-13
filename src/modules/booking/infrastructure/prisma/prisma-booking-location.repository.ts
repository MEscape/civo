import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';

import { LOCATION_SELECT, toLocation } from './booking-location-record-mapper';
import { locationsOf } from './tenant-ownership';

import type { BookingLocationId } from '../../domain/models/ids';
import type {
  BookingLocationFacts,
  BookingLocationRepository,
} from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Booking location',
});

/** Read-only access to the locations of a website, bound to its tenant and website in every statement. */
export class PrismaBookingLocationRepository implements BookingLocationRepository {
  findById(
    scope: BookingScope,
    id: BookingLocationId,
  ): AppResultAsync<BookingLocationFacts | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        locationsOf(scope)
          .where({ id })
          .select(...LOCATION_SELECT)
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toLocation(record)));
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaBookingLocationRepository = new PrismaBookingLocationRepository();
