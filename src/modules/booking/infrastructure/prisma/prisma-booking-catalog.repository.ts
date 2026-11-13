import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';

import { CATALOG_SERVICE_SELECT, toCatalogEntry } from './booking-catalog-record-mapper';
import { LOCATION_SELECT, toLocation } from './booking-location-record-mapper';
import { SERVICE_LOCATION_SELECT } from './service-location-record-mapper';
import { locationsOf, servicesOf } from './tenant-ownership';

import type {
  BookingCatalog,
  BookingCatalogRepository,
} from '../../domain/ports/booking-catalog.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Booking catalog',
});

/** The active services of a website with where they are switched on, and its active locations. */
export class PrismaBookingCatalogRepository implements BookingCatalogRepository {
  findCatalog(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<BookingCatalog, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        Promise.all([
          servicesOf(scope)
            .where({ isActive: true })
            .select(...CATALOG_SERVICE_SELECT)
            .include('locations', (rows) => rows.select(...SERVICE_LOCATION_SELECT))
            .orderBy((service) => service.name.asc())
            .limit(limit + 1)
            .all(),
          locationsOf(scope)
            .where({ isActive: true })
            .select(...LOCATION_SELECT)
            .orderBy((location) => location.name.asc())
            .limit(limit + 1)
            .all(),
        ]),
      failures.infraOnly('findCatalog'),
    ).andThen(([services, locations]) =>
      combine(services.slice(0, limit).map(toCatalogEntry)).andThen((entries) =>
        combine(locations.slice(0, limit).map(toLocation)).map((places) => ({
          entries,
          locations: places,
          isTruncated: services.length > limit || locations.length > limit,
        })),
      ),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaBookingCatalogRepository = new PrismaBookingCatalogRepository();
