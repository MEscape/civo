import { resolvePageRequest } from '@lib/pagination';

import { RESOURCE_PAGE_LIMITS } from '../../application/contracts/booking-constraints';
import { bookingRoutes } from '../routes';
import { parseResourceListParams } from '../schemas/parse-resource-list-input';

import { listNavigation } from './list-navigation';
import { resourceListHref } from './resource-list-href';

import type { ResourceListView } from './resource-list-href';

function originOf(view: ResourceListView & { readonly page: number }): string {
  return resourceListHref('', view, { page: view.page }).slice(1);
}

function parse(raw: string | string[] | undefined): string | undefined {
  const params = listNavigation.readOrigin(raw);
  if (params === undefined) {
    return undefined;
  }
  const filters = parseResourceListParams(params);
  return originOf({ ...filters, ...resolvePageRequest(filters.page, RESOURCE_PAGE_LIMITS) });
}

/** A resource keeps only its own location's list filters and slice, never a return path. */
export const resourceListNavigation = {
  originOf,
  parse,
  withOrigin: listNavigation.withOrigin,
  parent: (websiteId: string, locationId: string, origin: string | undefined) =>
    listNavigation.parent(bookingRoutes.locationResources(websiteId, locationId), parse(origin)),
};
