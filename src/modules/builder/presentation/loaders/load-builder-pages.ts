import { orNotFound } from '@lib/errors/or-not-found';
import { pageHrefOf, pageParamsSchema } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { toPageListItemDto } from '../dto/page-dto';

import type { ListPagesInput } from '../../application/contracts/page-inputs';
import type { PageListItemView } from '../../application/contracts/page-views';

/** What the page list reads with; the use case satisfies it. */
export interface BuilderPagesReaders {
  readonly listPages: {
    execute(input: ListPagesInput): AppResultAsync<Page<PageListItemView>>;
  };
}

interface LoadBuilderPagesInput {
  readonly websiteId: string;
  /** The page address without its query: pages are links back to it. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: BuilderPagesReaders;
}

/**
 * Reads what the page list shows: the slice of pages the address asks for. The list and its
 * navigation share the query's resolved pagination, including a clamped out-of-range request.
 * A person who may not read this website's pages gets "not found".
 */
export async function loadBuilderPages({
  websiteId,
  pathname,
  searchParams,
  queries,
}: LoadBuilderPagesInput) {
  const options = pageParamsSchema.parse(searchParams);
  const found = await orNotFound(queries.listPages.execute({ websiteId, ...options }));
  return {
    pages: { ...found, items: found.items.map(toPageListItemDto) },
    hrefFor: (page: number) => pageHrefOf(pathname, page, { pageSize: found.pageSize }),
  };
}
