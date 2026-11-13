import { z } from 'zod';

import { buildQueryString } from '@lib/utils';

/**
 * The page and size of a list address. Repeated or malformed values fall back to `undefined`, so the
 * query's own defaults and bounds apply (see `resolvePageRequest`); a hand-edited URL never throws.
 */
export const pageParamsSchema = z.object({
  page: z.string().optional().catch(undefined),
  pageSize: z.string().optional().catch(undefined),
});

type QueryParams = Parameters<typeof buildQueryString>[0];

/**
 * The address of one page of a list: page 1 is left out so the first page has one address. `query`
 * holds the query's resolved page size and the filters and sort the address must carry along.
 *
 * @example pageHrefOf('/media', 2, { pageSize: 25, q: 'logo' }) // '/media?q=logo&page=2&pageSize=25'
 */
export function pageHrefOf(
  pathname: string,
  page: number,
  query: QueryParams & { readonly pageSize: number },
): string {
  const { pageSize, ...keep } = query;
  return `${pathname}${buildQueryString({ ...keep, page: page === 1 ? undefined : page, pageSize })}`;
}
