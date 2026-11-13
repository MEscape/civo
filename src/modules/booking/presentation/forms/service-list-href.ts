import { buildQueryString } from '@lib/utils';

import type { ServiceOriginKind } from '../../application/contracts/booking-constraints';
import type { ServiceStatusFilter } from '../schemas/parse-service-list-input';

/** What the address of the services list carries now. */
export interface ServiceListView {
  readonly search: string | undefined;
  readonly category: string | undefined;
  readonly origin: ServiceOriginKind | undefined;
  readonly status: ServiceStatusFilter;
  readonly pageSize: number;
}

/**
 * The address of the list with a different page and everything else kept (the search, the filters,
 * the page size), so a page link never loses them. The running services and the first page are the
 * defaults and are left out.
 */
export function serviceListHref(
  base: string,
  view: ServiceListView,
  change: { readonly page?: number } = {},
): string {
  return `${base}${buildQueryString({
    q: view.search,
    category: view.category,
    origin: view.origin,
    status: view.status === 'active' ? undefined : view.status,
    page: change.page,
    pageSize: view.pageSize,
  })}`;
}

/** What the address of the adopt screen carries now. */
export interface AdoptView {
  readonly search: string | undefined;
  readonly source: string | undefined;
  readonly service: string | undefined;
  readonly from: string | undefined;
  readonly pageSize: number;
}

/** The address of the adopt screen with a different page or pick and the rest of the view kept. */
export function adoptHref(
  base: string,
  view: AdoptView,
  change: {
    readonly page?: number;
    readonly pick?: { readonly service: string; readonly from: string };
  } = {},
): string {
  return `${base}${buildQueryString({
    q: view.search,
    source: view.source,
    service: change.pick?.service ?? view.service,
    from: change.pick?.from ?? view.from,
    page: change.page,
    pageSize: view.pageSize,
  })}`;
}
