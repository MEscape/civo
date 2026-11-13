import { resolvePageRequest } from '@lib/pagination';

import { SERVICE_PAGE_LIMITS } from '../../application/contracts/booking-constraints';
import { bookingRoutes } from '../routes';
import { parseServiceListParams } from '../schemas/parse-service-list-input';

import { listNavigation } from './list-navigation';
import { serviceListHref } from './service-list-href';

import type { ServiceListView } from './service-list-href';

function originOf(view: ServiceListView & { readonly page: number }): string {
  return serviceListHref('', view, { page: view.page }).slice(1);
}

function parse(raw: string | string[] | undefined): string | undefined {
  const params = listNavigation.readOrigin(raw);
  if (params === undefined) {
    return undefined;
  }
  const filters = parseServiceListParams(params);
  return originOf({ ...filters, ...resolvePageRequest(filters.page, SERVICE_PAGE_LIMITS) });
}

/** A service keeps only its own location's list filters and slice, never a return path. */
export const serviceListNavigation = {
  originOf,
  parse,
  withOrigin: listNavigation.withOrigin,
  parent: (websiteId: string, locationId: string, origin: string | undefined) =>
    listNavigation.parent(bookingRoutes.locationServices(websiteId, locationId), parse(origin)),
};
