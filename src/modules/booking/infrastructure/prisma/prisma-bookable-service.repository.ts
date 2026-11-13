import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';
import { loadResourceTypes } from '../transactions/service-settings-loader';

import { SERVICE_SELECT, toService } from './bookable-service-record-mapper';
import { SERVICE_LOCATION_SELECT, readSettings } from './service-location-record-mapper';
import { servicesOf } from './tenant-ownership';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookableServiceId } from '../../domain/models/ids';
import type { BookableServiceRepository } from '../../domain/ports/bookable-service.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Bookable service',
});

/**
 * Read-only access to the services of a website as the booking rules read them, with the locations
 * each one is switched on at. Bound to its tenant and website in every statement.
 */
export class PrismaBookableServiceRepository implements BookableServiceRepository {
  findById(
    scope: BookingScope,
    id: BookableServiceId,
  ): AppResultAsync<BookableService | null, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const record = await servicesOf(scope)
        .where({ id })
        .select(...SERVICE_SELECT)
        .include('locations', (rows) => rows.select(...SERVICE_LOCATION_SELECT))
        .first();
      if (record === null) {
        return null;
      }
      return { record, types: await loadResourceTypes(scope, record.locations) };
    }, failures.infraOnly('findById')).andThen((found) =>
      found === null
        ? okAsync(null)
        : readSettings(found.record.locations, found.types).andThen((settings) =>
            toService(found.record, settings),
          ),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaBookableServiceRepository = new PrismaBookableServiceRepository();
