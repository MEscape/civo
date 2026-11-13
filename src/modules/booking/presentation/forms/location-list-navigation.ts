import { resolvePageRequest } from '@lib/pagination';

import { LOCATION_PAGE_LIMITS } from '../../application/contracts/booking-constraints';
import { bookingRoutes } from '../routes';
import { parseLocationListParams } from '../schemas/parse-location-list-input';

import { listNavigation } from './list-navigation';
import { locationListHref } from './location-list-href';

import type { LocationListView } from './location-list-href';

/** Only a location list's normalized filters and slice travel with its detail/editor, never a destination. */
function originOf(view: LocationListView & { readonly page: number }): string {
  return locationListHref('', view, { page: view.page }).slice(1);
}

function parse(raw: string | string[] | undefined): string | undefined {
  const params = listNavigation.readOrigin(raw);
  if (params === undefined) {
    return undefined;
  }
  const filters = parseLocationListParams(params);
  return originOf({ ...filters, ...resolvePageRequest(filters.page, LOCATION_PAGE_LIMITS) });
}

export const locationListNavigation = {
  originOf,
  parse,
  withOrigin: listNavigation.withOrigin,
  /** A direct entity URL returns to the default list; a carried origin can only change its query. */
  parent: (websiteId: string, origin: string | undefined) => {
    const normalized = parse(origin);
    return listNavigation.parent(bookingRoutes.locations(websiteId), normalized);
  },
};
