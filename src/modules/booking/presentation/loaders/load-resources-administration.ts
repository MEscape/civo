import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';

import { parseResourceListParams } from '../schemas/parse-resource-list-input';

import type { BookingReaders, RawSearchParams } from './booking-readers';

interface Input {
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
  readonly queries: BookingReaders;
}

/** Reads the resources of one location: the page the address asks for. */
export async function loadResourcesAdministration({
  websiteId,
  locationId,
  searchParams,
  queries,
}: Input) {
  const filters = parseResourceListParams(searchParams);
  const page = await orNotFound(
    queries.listResources.execute({
      websiteId,
      locationId,
      search: filters.search,
      type: filters.type,
      page: filters.page,
    }),
  );
  return { filters, page };
}

/** Reads one resource; one that belongs to another location is "not found" at this address. */
export async function loadResourceDetail(
  input: { readonly websiteId: string; readonly locationId: string; readonly resourceId: string },
  queries: BookingReaders,
) {
  const resource = await orNotFound(
    queries.getResource.execute({ websiteId: input.websiteId, resourceId: input.resourceId }),
  );
  if (resource.location.id !== input.locationId) {
    notFound();
  }
  return resource;
}

/** Reads the location a new resource is made at. */
export function loadResourceLocation(
  input: { readonly websiteId: string; readonly locationId: string },
  queries: BookingReaders,
) {
  return orNotFound(queries.getLocation.execute(input));
}
