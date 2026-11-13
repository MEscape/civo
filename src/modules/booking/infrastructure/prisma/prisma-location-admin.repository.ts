import { randomUUID } from 'node:crypto';

import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  locationNotFound,
  locationStale,
} from '../../domain/errors/booking-errors';
import { toBookingLocationId } from '../../domain/models/ids';
import { asInstant, laterOf } from '../../domain/time/instant';

import { toRecordInstant, versionWindow } from './instant-record-mapper';
import {
  LOCATION_ADMIN_SELECT,
  toLocationColumns,
  toStoredLocation,
} from './location-admin-record-mapper';
import { locationsOf } from './tenant-ownership';

import type { LocationAdminRecord } from './location-admin-record-mapper';
import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  LocationAdminRepository,
  LocationChange,
  LocationListQuery,
  LocationWriteError,
  NewLocation,
  StoredLocation,
} from '../../domain/ports/location-admin.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Booking location',
});

/** `%` and `_` in what a person typed mean themselves, not "anything". */
const LIKE_SPECIALS = /[\\%_]/g;

function matching(scope: BookingScope, { search, isActive }: LocationListQuery) {
  let records = locationsOf(scope);
  if (isActive !== undefined) {
    records = records.where({ isActive });
  }
  const text = search?.trim();
  if (text !== undefined && text !== '') {
    const pattern = `%${text.replace(LIKE_SPECIALS, '\\$&')}%`;
    records = records.where((location) => location.name.ilike(pattern));
  }
  return records;
}

function readAll(
  records: readonly LocationAdminRecord[],
): AppResultAsync<readonly StoredLocation[], InfrastructureAppError> {
  return combine(records.map((record) => toStoredLocation(record))).asyncMap((all) =>
    Promise.resolve(all),
  );
}

/**
 * The administration's access to locations, bound to the tenant and the website in every statement.
 * A change is one `UPDATE … WHERE id AND updatedAt`, the same compare-and-swap the bookings use: the
 * ORM's `update()` reads the row first and would let a second writer through.
 */
export class PrismaLocationAdminRepository implements LocationAdminRepository {
  count(
    scope: BookingScope,
    query: LocationListQuery,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const { total } = await matching(scope, query).aggregate((aggregate) => ({
        total: aggregate.count(),
      }));
      return total;
    }, failures.infraOnly('countLocations'));
  }

  list(
    scope: BookingScope,
    query: LocationListQuery,
  ): AppResultAsync<readonly StoredLocation[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        matching(scope, query)
          .select(...LOCATION_ADMIN_SELECT)
          .orderBy([(location) => location.name.asc(), (location) => location.id.asc()])
          .limit(query.limit)
          .offset(query.offset)
          .all(),
      failures.infraOnly('listLocations'),
    ).andThen(readAll);
  }

  findById(
    scope: BookingScope,
    id: BookingLocationId,
  ): AppResultAsync<StoredLocation | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        locationsOf(scope)
          .where({ id })
          .select(...LOCATION_ADMIN_SELECT)
          .first(),
      failures.infraOnly('findLocation'),
    ).andThen((record) => (record === null ? okAsync(null) : toStoredLocation(record)));
  }

  create(
    scope: BookingScope,
    location: NewLocation,
    now: Instant,
  ): AppResultAsync<StoredLocation, InfrastructureAppError> {
    const id = randomUUID();
    const stamp = toRecordInstant(now);
    return fromThrowableAsync(async () => {
      await db.orm.public.BookingLocation.select('id').create({
        id,
        tenantId: scope.tenantId,
        websiteId: scope.websiteId,
        ...toLocationColumns(location),
        createdAt: stamp,
        updatedAt: stamp,
      });
      return { ...location, id: toBookingLocationId(id), updatedAt: now };
    }, failures.infraOnly('createLocation'));
  }

  save(
    scope: BookingScope,
    { stored, expected, now }: LocationChange,
  ): AppResultAsync<StoredLocation, LocationWriteError> {
    // The stamp is the version the next writer must name, so it differs from the one it replaces
    // even when this clock is not past it.
    const stamp = laterOf(now, asInstant(expected + 1));
    return fromThrowableAsync(
      async () =>
        locationsOf(scope)
          .where({ id: stored.id })
          .where((location) => location.updatedAt.gte(versionWindow(expected).from))
          .where((location) => location.updatedAt.lt(versionWindow(expected).until))
          .updateAndCount({ ...toLocationColumns(stored), updatedAt: toRecordInstant(stamp) }),
      failures.infraOnly('saveLocation'),
    ).andThen((swapped): AppResultAsync<StoredLocation, LocationWriteError> => {
      if (swapped > 0) {
        return okAsync({ ...stored, updatedAt: stamp });
      }
      return this.findById(scope, stored.id).andThen((current) =>
        errAsync(current === null ? locationNotFound() : locationStale()),
      );
    });
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaLocationAdminRepository = new PrismaLocationAdminRepository();
