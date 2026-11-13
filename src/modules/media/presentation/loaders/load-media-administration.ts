import { orNotFound } from '@lib/errors/or-not-found';
import { formatSort, resolveSort } from '@lib/pagination';
import type { SortSpec } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

import {
  DEFAULT_MEDIA_SORT,
  MEDIA_SORT_FIELDS,
} from '../../application/contracts/media-constraints';
import { mediaListParamsSchema } from '../schemas/media-list-params-schema';

import type {
  MediaSortField,
  MediaVisibility,
} from '../../application/contracts/media-constraints';
import type { MediaReaders } from '../../application/contracts/media-views';

interface LoadMediaAdministrationInput {
  readonly websiteId: string;
  /** The page address without its query: pages, filters and sorts are links back to it. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: MediaReaders;
}

/** What the address asks for, already bounded. */
interface MediaFilters {
  readonly text: string | null;
  readonly visibility: MediaVisibility | null;
  readonly sort: SortSpec<MediaSortField>;
}

/** A heading's first press: names A to Z, dates newest first. A second press reverses it. */
function nextSort(
  current: SortSpec<MediaSortField>,
  field: MediaSortField,
): SortSpec<MediaSortField> {
  if (current.field === field) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: field === 'name' ? 'asc' : 'desc' };
}

/**
 * Reads what the library shows: the page of files the address asks for, narrowed by its search
 * and visibility and in its order, plus the links between pages, sorts and quick filters. Every
 * link keeps the other parts of the address. A person who may not read this website's media gets
 * "not found".
 */
export async function loadMediaAdministration({
  websiteId,
  pathname,
  searchParams,
  queries,
}: LoadMediaAdministrationInput) {
  const params = mediaListParamsSchema.parse(searchParams);
  const filters: MediaFilters = {
    text: params.q === undefined || params.q === '' ? null : params.q,
    visibility: params.visibility ?? null,
    sort: resolveSort(params.sort, MEDIA_SORT_FIELDS, DEFAULT_MEDIA_SORT),
  };
  const assets = await orNotFound(
    queries.listAssets.execute(websiteId, {
      page: params.page,
      pageSize: params.pageSize,
      search: filters.text ?? undefined,
      visibility: filters.visibility ?? undefined,
      sort: filters.sort,
    }),
  );
  const linkTo = (target: Partial<MediaFilters> & { readonly page?: number }) => {
    const next = { ...filters, ...target };
    const sort = formatSort(next.sort);
    return `${pathname}${buildQueryString({
      q: next.text ?? undefined,
      visibility: next.visibility ?? undefined,
      sort: sort === formatSort(DEFAULT_MEDIA_SORT) ? undefined : sort,
      page: next.page === undefined || next.page === 1 ? undefined : next.page,
      pageSize: assets.pageSize,
    })}`;
  };

  return {
    assets,
    filters,
    hasFilters: filters.text !== null || filters.visibility !== null,
    hrefFor: (page: number) => linkTo({ page }),
    /** A column heading's link: the first page, sorted by it, reversed when it already is. */
    sortHref: (field: MediaSortField) => linkTo({ sort: nextSort(filters.sort, field) }),
    visibilityHref: (visibility: MediaVisibility | null) => linkTo({ visibility }),
    resetHref: linkTo({ text: null, visibility: null }),
  };
}

export type MediaAdministrationView = Awaited<ReturnType<typeof loadMediaAdministration>>;
