import { buildQueryString } from '@lib/utils';

/** What the address of the resources list carries now. */
export interface ResourceListView {
  readonly search: string | undefined;
  readonly type: string | undefined;
  readonly pageSize: number;
}

/** The address of the list with a different page and everything else kept, so a page link never loses the filters. */
export function resourceListHref(
  base: string,
  view: ResourceListView,
  change: { readonly page?: number } = {},
): string {
  return `${base}${buildQueryString({
    q: view.search,
    type: view.type,
    page: change.page,
    pageSize: view.pageSize,
  })}`;
}
