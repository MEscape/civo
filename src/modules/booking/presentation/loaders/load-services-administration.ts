import { orNotFound } from '@lib/errors/or-not-found';

import {
  parseAdoptParams,
  parseServiceListParams,
  statusOf,
} from '../schemas/parse-service-list-input';

import type { BookingReaders, RawSearchParams } from './booking-readers';

interface Input {
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
  readonly queries: BookingReaders;
}

/** Reads the services switched on at one location: the page the address asks for. */
export async function loadServicesAdministration({
  websiteId,
  locationId,
  searchParams,
  queries,
}: Input) {
  const filters = parseServiceListParams(searchParams);
  const page = await orNotFound(
    queries.listServices.execute({
      websiteId,
      locationId,
      search: filters.search,
      category: filters.category,
      origin: filters.origin,
      status: statusOf(filters.status),
      page: filters.page,
    }),
  );
  return { filters, page };
}

/** Reads one service at a location. */
export function loadServiceDetail(
  input: { readonly websiteId: string; readonly locationId: string; readonly serviceId: string },
  queries: BookingReaders,
) {
  return orNotFound(queries.getService.execute(input));
}

/** Reads a service form: the service when there is one, and the choices its fields offer. */
export async function loadServiceForm(
  input: {
    readonly websiteId: string;
    readonly locationId: string;
    readonly serviceId?: string | undefined;
  },
  queries: BookingReaders,
) {
  const { websiteId, locationId, serviceId } = input;
  const [service, options] = await Promise.all([
    serviceId === undefined
      ? Promise.resolve(null)
      : orNotFound(queries.getService.execute({ websiteId, locationId, serviceId })),
    orNotFound(queries.getServiceFormOptions.execute({ websiteId, locationId })),
  ]);
  return { service, options };
}

/** Reads the services another location offers that this one could take over. */
export async function loadAdoptServices({ websiteId, locationId, searchParams, queries }: Input) {
  const filters = parseAdoptParams(searchParams);
  const page = await orNotFound(
    queries.listAdoptableServices.execute({
      websiteId,
      locationId,
      search: filters.search,
      sourceLocationId: filters.source,
      page: filters.page,
    }),
  );
  return { filters, page };
}
