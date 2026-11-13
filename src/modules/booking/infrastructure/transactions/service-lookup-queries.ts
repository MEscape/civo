import { isString } from '@lib/utils';

import { toBookableServiceId } from '../../domain/models/ids';
import { STORED_SERVICE_SELECT, toStoredService } from '../prisma/service-admin-record-mapper';
import {
  readStoredSettings,
  STORED_SERVICE_LOCATION_SELECT,
} from '../prisma/service-location-record-mapper';
import { serviceLocationsOf, servicesOf } from '../prisma/tenant-ownership';

import { loadResourceTypes } from './service-settings-loader';

import type { BookableServiceId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';

/** One service with every location it is on and the type of each resource it names; `null` when it is not in the scope. */
export async function readService(scope: BookingScope, id: BookableServiceId) {
  const record = await servicesOf(scope)
    .where({ id })
    .select(...STORED_SERVICE_SELECT)
    .include('locations', (rows) => rows.select(...STORED_SERVICE_LOCATION_SELECT))
    .first();
  if (record === null) {
    return null;
  }
  const types = await loadResourceTypes(scope, record.locations);
  return readStoredSettings(record.locations, types).andThen((settings) =>
    toStoredService(record, settings),
  );
}

/** Every service of the website by id and name, in name order: what a list of bookings is labelled with. */
export async function readServiceNames(scope: BookingScope, limit: number) {
  const rows = await servicesOf(scope)
    .select('id', 'name', 'category', 'isActive')
    .orderBy([(service) => service.name.asc(), (service) => service.id.asc()])
    .limit(limit + 1)
    .all();
  return {
    services: rows.slice(0, limit).map(({ id, name, category, isActive }) => ({
      id: toBookableServiceId(id),
      name,
      category: category === '' ? null : category,
      isActive,
    })),
    isTruncated: rows.length > limit,
  };
}

/** The categories in use, each once, in name order. */
export async function readCategories(scope: BookingScope, limit: number) {
  const rows = await servicesOf(scope)
    .select('category')
    .limit(limit + 1)
    .all();
  const names = new Set(
    rows
      .slice(0, limit)
      .flatMap((row) => (row.category === null || row.category === '' ? [] : [row.category])),
  );
  return {
    categories: [...names].sort((a, b) => a.localeCompare(b)),
    isTruncated: rows.length > limit,
  };
}

/** The resource a stored link names, or `null` when the JSON is not in the shape the writes make. */
function resourceIdOf(link: unknown): string | null {
  if (typeof link !== 'object' || link === null || !('resourceId' in link)) {
    return null;
  }
  const { resourceId } = link;
  return isString(resourceId) ? resourceId : null;
}

/** How many services name each resource, required or optional, across all locations. */
export async function readResourceUse(scope: BookingScope, limit: number) {
  const rows = await serviceLocationsOf(scope)
    .select('serviceId', 'resources')
    .limit(limit + 1)
    .all();
  const services = new Map<string, Set<string>>();
  for (const row of rows.slice(0, limit)) {
    const links: readonly unknown[] = Array.isArray(row.resources) ? row.resources : [];
    for (const link of links) {
      const resourceId = resourceIdOf(link);
      if (resourceId !== null) {
        services.set(resourceId, (services.get(resourceId) ?? new Set()).add(row.serviceId));
      }
    }
  }
  return {
    counts: new Map([...services].map(([resourceId, users]) => [resourceId, users.size])),
    isTruncated: rows.length > limit,
  };
}
