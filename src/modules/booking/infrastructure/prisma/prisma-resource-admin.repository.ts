import { randomUUID } from 'node:crypto';

import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, err, errAsync, fromThrowableAsync, ok, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import {
  BOOKING_ERROR_CODES as CODES,
  bookingDataInvalid,
  resourceNotFound,
  resourceStale,
} from '../../domain/errors/booking-errors';
import { toBookableResourceId, toBookableServiceId } from '../../domain/models/ids';
import { asInstant, laterOf } from '../../domain/time/instant';

import { toRecordInstant, versionWindow } from './instant-record-mapper';
import {
  RESOURCE_ADMIN_SELECT,
  toNewResourceColumns,
  toResourceChangeColumns,
  toStoredResource,
} from './resource-admin-record-mapper';
import { readLinks } from './service-location-record-mapper';
import { resourcesOf, serviceLocationsOf, servicesOf } from './tenant-ownership';

import type { ResourceAdminRecord } from './resource-admin-record-mapper';
import type { BookableResourceId, BookingLocationId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  NewResource,
  ResourceAdminListQuery,
  ResourceAdminRepository,
  ResourceChange,
  ResourceUser,
  ResourceWriteError,
  StoredResource,
} from '../../domain/ports/resource-admin.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Bookable resource',
});

/** `%` and `_` in what a person typed mean themselves, not "anything". */
const LIKE_SPECIALS = /[\\%_]/g;

/** The physical resources of a location: a person's calendar is never one of them. */
function physicalAt(scope: BookingScope, locationId: BookingLocationId) {
  return resourcesOf(scope)
    .where({ locationId })
    .where((resource) => resource.type.neq('employee'));
}

function matching(scope: BookingScope, { locationId, search, type }: ResourceAdminListQuery) {
  let records = physicalAt(scope, locationId);
  if (type !== undefined) {
    records = records.where({ type });
  }
  const text = search?.trim();
  if (text !== undefined && text !== '') {
    const pattern = `%${text.replace(LIKE_SPECIALS, '\\$&')}%`;
    records = records.where((resource) => resource.name.ilike(pattern));
  }
  return records;
}

function readAll(
  records: readonly ResourceAdminRecord[],
): AppResultAsync<readonly StoredResource[], InfrastructureAppError> {
  return combine(records.map((record) => toStoredResource(record))).asyncMap((all) =>
    Promise.resolve(all),
  );
}

async function readUsers(
  scope: BookingScope,
  locationId: BookingLocationId,
  limit: number,
): Promise<{ users: ResourceUser[]; isTruncated: boolean } | null> {
  const read = await serviceLocationsOf(scope)
    .where({ locationId })
    .select('serviceId', 'resources')
    .orderBy([(row) => row.serviceId.asc()])
    .limit(limit + 1)
    .all();
  const rows = read.slice(0, limit);
  const serviceIds = unique(rows.map((row) => row.serviceId));
  const names =
    serviceIds.length === 0
      ? []
      : await servicesOf(scope)
          .where((service) => service.id.in(serviceIds))
          .select('id', 'name')
          .all();
  const nameOf = new Map(names.map((service) => [service.id, service.name]));
  const users: ResourceUser[] = [];
  for (const row of rows) {
    const links = readLinks(row.resources);
    if (links === null) {
      return null;
    }
    const serviceName = nameOf.get(row.serviceId);
    for (const link of links) {
      if (serviceName !== undefined) {
        users.push({
          resourceId: toBookableResourceId(link.resourceId),
          serviceId: toBookableServiceId(row.serviceId),
          serviceName,
          isRequired: link.isRequired,
        });
      }
    }
  }
  return {
    users: users.sort((a, b) => a.serviceName.localeCompare(b.serviceName)),
    isTruncated: read.length > limit,
  };
}

/**
 * The administration's access to physical resources, bound to the tenant and the website in every
 * statement. A change is one `UPDATE … WHERE id AND updatedAt` (the ORM's `update()` reads first and
 * would let a second writer through), and it never names the kind or the location.
 */
export class PrismaResourceAdminRepository implements ResourceAdminRepository {
  count(
    scope: BookingScope,
    query: ResourceAdminListQuery,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const { total } = await matching(scope, query).aggregate((aggregate) => ({
        total: aggregate.count(),
      }));
      return total;
    }, failures.infraOnly('countResources'));
  }

  list(
    scope: BookingScope,
    query: ResourceAdminListQuery,
  ): AppResultAsync<readonly StoredResource[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        matching(scope, query)
          .select(...RESOURCE_ADMIN_SELECT)
          .orderBy([(resource) => resource.name.asc(), (resource) => resource.id.asc()])
          .limit(query.limit)
          .offset(query.offset)
          .all(),
      failures.infraOnly('listResources'),
    ).andThen(readAll);
  }

  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<StoredResource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(scope)
          .where({ id })
          .where((resource) => resource.type.neq('employee'))
          .select(...RESOURCE_ADMIN_SELECT)
          .first(),
      failures.infraOnly('findResource'),
    ).andThen((record) => (record === null ? okAsync(null) : toStoredResource(record)));
  }

  listUsers(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly users: readonly ResourceUser[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      () => readUsers(scope, locationId, limit),
      failures.infraOnly('listResourceUsers'),
    ).andThen((users) =>
      users === null ? err(bookingDataInvalid('service location resources')) : ok(users),
    );
  }

  create(
    scope: BookingScope,
    resource: NewResource,
    now: Instant,
  ): AppResultAsync<StoredResource, InfrastructureAppError> {
    const id = randomUUID();
    const stamp = toRecordInstant(now);
    return fromThrowableAsync(async () => {
      await db.orm.public.BookableResource.select('id').create({
        id,
        tenantId: scope.tenantId,
        websiteId: scope.websiteId,
        ...toNewResourceColumns(resource),
        createdAt: stamp,
        updatedAt: stamp,
      });
      return { ...resource, id: toBookableResourceId(id), updatedAt: now };
    }, failures.infraOnly('createResource'));
  }

  save(
    scope: BookingScope,
    { stored, expected, now }: ResourceChange,
  ): AppResultAsync<StoredResource, ResourceWriteError> {
    // The stamp is the version the next writer must name, so it differs from the one it replaces
    // even when this clock is not past it.
    const stamp = laterOf(now, asInstant(expected + 1));
    return fromThrowableAsync(
      async () =>
        resourcesOf(scope)
          .where({ id: stored.id })
          .where((resource) => resource.updatedAt.gte(versionWindow(expected).from))
          .where((resource) => resource.updatedAt.lt(versionWindow(expected).until))
          .where((resource) => resource.type.neq('employee'))
          .updateAndCount({
            ...toResourceChangeColumns(stored),
            updatedAt: toRecordInstant(stamp),
          }),
      failures.infraOnly('saveResource'),
    ).andThen((swapped): AppResultAsync<StoredResource, ResourceWriteError> => {
      if (swapped > 0) {
        return okAsync({ ...stored, updatedAt: stamp });
      }
      return this.findById(scope, stored.id).andThen((current) =>
        errAsync(current === null ? resourceNotFound() : resourceStale()),
      );
    });
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaResourceAdminRepository = new PrismaResourceAdminRepository();
