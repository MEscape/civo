import { buildQueryString } from '@lib/utils';

import type { LocationStatusFilter } from '../schemas/parse-location-list-input';

/** What the address of the list carries now. */
export interface LocationListView {
  readonly search: string | undefined;
  readonly status: LocationStatusFilter;
  readonly pageSize: number;
}

/**
 * The address of the list with a different status or page and everything else kept (the search, the
 * page size), so a tab or a page link never loses the filters. "All" and the first page are the
 * defaults and are left out.
 */
export function locationListHref(
  base: string,
  view: LocationListView,
  change: { readonly status?: LocationStatusFilter; readonly page?: number } = {},
): string {
  const status = change.status ?? view.status;
  return `${base}${buildQueryString({
    q: view.search,
    status: status === 'all' ? undefined : status,
    page: change.page,
    pageSize: view.pageSize,
  })}`;
}
