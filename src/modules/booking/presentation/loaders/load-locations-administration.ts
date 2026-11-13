import { orNotFound } from '@lib/errors/or-not-found';
import { orNull } from '@lib/errors/or-null';

import { isActiveOf, parseLocationListParams } from '../schemas/parse-location-list-input';

import type { BookingReaders, RawSearchParams } from './booking-readers';

export interface LoadLocationsInput {
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly queries: BookingReaders;
}

/** Reads what the locations list shows: the page the address asks for, and how far the setup has come. */
export async function loadLocationsAdministration({
  websiteId,
  searchParams,
  queries,
}: LoadLocationsInput) {
  const filters = parseLocationListParams(searchParams);
  const [page, setup] = await Promise.all([
    orNotFound(
      queries.listLocations.execute({
        websiteId,
        search: filters.search,
        isActive: isActiveOf(filters.status),
        page: filters.page,
      }),
    ),
    orNotFound(queries.getBookingSetup.execute({ websiteId })),
  ]);
  return { filters, page, setup };
}

/** Reads one location's overview. */
export function loadLocationDetail(
  input: { readonly websiteId: string; readonly locationId: string },
  queries: BookingReaders,
) {
  return orNotFound(queries.getLocation.execute(input));
}

/**
 * Reads where an area that is looked after one location at a time starts: the locations to choose
 * from, and how far the setup has come. With exactly one location there is nothing to choose, and
 * the answer is that location's id.
 */
export async function loadLocationEntry(input: LoadLocationsInput) {
  const { page, setup } = await loadLocationsAdministration(input);
  const [only] = page.items;
  return { page, setup, onlyLocationId: page.total === 1 ? only?.id : undefined };
}

/**
 * Reads the services of other locations a new location could take over: the wizard's services step,
 * which exists only when this is not empty. A read that fails leaves the step out; it is not needed to
 * make a location.
 */
export async function loadOfferableServices(
  input: { readonly websiteId: string },
  queries: BookingReaders,
) {
  const offerable = await orNull(queries.listOfferableServices.execute(input));
  return offerable?.items ?? [];
}
