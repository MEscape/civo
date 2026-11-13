import { getPath } from '@lib/utils';

export const PAGINATION_KINDS = ['none', 'offset', 'page', 'cursor', 'next-url'] as const;
export type PaginationKind = (typeof PAGINATION_KINDS)[number];

/** Where a pagination parameter travels: the query string, or the JSON body of a POST. */
export const PARAM_PLACEMENTS = ['query', 'body'] as const;
export type ParamPlacement = (typeof PARAM_PLACEMENTS)[number];

export type RequestMethod = 'GET' | 'POST';

export const PAGINATION_LIMITS = {
  /** Pages one read may fetch, however many records are wanted: a runaway API cannot hold a request open. */
  maxPages: 10,
  minPageSize: 1,
  maxPageSize: 1_000,
  defaultPageSize: 100,
  maxNameLength: 64,
  maxPathLength: 200,
} as const;

/**
 * How an external API hands out its records page by page. Each variant is
 * ONE mechanism and says explicitly where its parameters go: nothing is
 * guessed from a response, because the signals APIs give (a `next` link, a
 * total count, a short page) are not reliable across APIs.
 *
 *  - `none`      the endpoint returns everything in one answer.
 *  - `offset`    `limit` + `offset` parameters (SQL-like).
 *  - `page`      a page number, optionally with a page size.
 *  - `cursor`    an opaque token read from the previous answer and sent back.
 *  - `next-url`  the previous answer names the URL of the next page (anchors,
 *                hypermedia links). It must stay on the configured origin.
 */
export type PaginationStrategy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'offset';
      readonly limitParam: string;
      readonly offsetParam: string;
      readonly pageSize: number;
      readonly placement: ParamPlacement;
    }
  | {
      readonly kind: 'page';
      readonly pageParam: string;
      readonly sizeParam: string | null;
      readonly firstPage: number;
      readonly pageSize: number;
      readonly placement: ParamPlacement;
    }
  | {
      readonly kind: 'cursor';
      readonly cursorParam: string;
      /** Dot path of the next cursor in the previous answer; missing or empty ends the read. */
      readonly nextCursorPath: string;
      readonly sizeParam: string | null;
      readonly pageSize: number;
      readonly placement: ParamPlacement;
    }
  | {
      readonly kind: 'next-url';
      /** Dot path of the next page's URL in the previous answer; missing or empty ends the read. */
      readonly nextUrlPath: string;
    };

export const NO_PAGINATION: PaginationStrategy = { kind: 'none' };

/** What to ask for next: parameters to merge into the request, or a whole URL to follow. */
export type PageRequest =
  | {
      readonly kind: 'params';
      readonly placement: ParamPlacement;
      readonly params: Readonly<Record<string, string | number>>;
    }
  | { readonly kind: 'url'; readonly url: string };

/** What the connector knows after fetching a page. */
export interface PageProgress {
  /** Pages fetched so far, at least one. */
  readonly pages: number;
  /** Records of the page just fetched. */
  readonly pageRecords: number;
  /** Records of all pages so far. */
  readonly totalRecords: number;
  /** The record the first page started at (an offset or page read starts where the window does). */
  readonly startOffset: number;
  /** The raw answer of the page just fetched (cursor and next-url strategies read it). */
  readonly body: unknown;
  /** Cursors and URLs already requested: seeing one again would loop forever. */
  readonly visited: ReadonlySet<string>;
}

function sizeParams(sizeParam: string | null, pageSize: number): Readonly<Record<string, number>> {
  return sizeParam === null ? {} : { [sizeParam]: pageSize };
}

/** Where a read starts: the first request to send and how many records of its answer come before the wanted ones. */
interface ReadStart {
  /** `null`: the plain endpoint is asked. */
  readonly request: PageRequest | null;
  /** Records to drop from the front of what is read. */
  readonly skip: number;
}

/**
 * The first request of a read that starts at record `startAt`. Offset and
 * page strategies jump straight there; a cursor or a next link can only be
 * followed from the beginning, so those walk and drop `startAt` records.
 */
export function firstPageRequest(strategy: PaginationStrategy, startAt: number): ReadStart {
  switch (strategy.kind) {
    case 'none':
    case 'next-url':
      return { request: null, skip: startAt };
    case 'offset':
      return {
        request: {
          kind: 'params',
          placement: strategy.placement,
          params: { [strategy.limitParam]: strategy.pageSize, [strategy.offsetParam]: startAt },
        },
        skip: 0,
      };
    case 'page': {
      const pageIndex = Math.floor(startAt / strategy.pageSize);
      return {
        request: {
          kind: 'params',
          placement: strategy.placement,
          params: {
            [strategy.pageParam]: strategy.firstPage + pageIndex,
            ...sizeParams(strategy.sizeParam, strategy.pageSize),
          },
        },
        skip: startAt - pageIndex * strategy.pageSize,
      };
    }
    case 'cursor':
      return {
        request:
          strategy.sizeParam === null
            ? null
            : {
                kind: 'params',
                placement: strategy.placement,
                params: sizeParams(strategy.sizeParam, strategy.pageSize),
              },
        skip: startAt,
      };
  }
}

function tokenOf(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return typeof value === 'number' ? String(value) : null;
}

function paramsRequest(
  strategy: { readonly placement: ParamPlacement },
  params: Readonly<Record<string, string | number>>,
): PageRequest {
  return { kind: 'params', placement: strategy.placement, params };
}

type ParameterStrategy = Extract<
  PaginationStrategy,
  { readonly kind: 'offset' | 'page' | 'cursor' }
>;

/**
 * The request for the page after the one `progress` describes, or `null` when
 * the read is complete. A page shorter than the page size is the last one: the
 * page size is configured to what the API honours.
 */
export function nextPageRequest(
  strategy: PaginationStrategy,
  progress: PageProgress,
): PageRequest | null {
  if (progress.pageRecords === 0 || strategy.kind === 'none') {
    return null;
  }
  if (strategy.kind === 'next-url') {
    const url = tokenOf(getPath(progress.body, strategy.nextUrlPath));
    return url === null || progress.visited.has(url) ? null : { kind: 'url', url };
  }
  return nextParameterRequest(strategy, progress);
}

function nextParameterRequest(
  strategy: ParameterStrategy,
  progress: PageProgress,
): PageRequest | null {
  if (strategy.kind === 'cursor') {
    const cursor = tokenOf(getPath(progress.body, strategy.nextCursorPath));
    return cursor === null || progress.visited.has(cursor)
      ? null
      : paramsRequest(strategy, {
          [strategy.cursorParam]: cursor,
          ...sizeParams(strategy.sizeParam, strategy.pageSize),
        });
  }
  if (progress.pageRecords < strategy.pageSize) {
    return null;
  }
  if (strategy.kind === 'offset') {
    return paramsRequest(strategy, {
      [strategy.limitParam]: strategy.pageSize,
      [strategy.offsetParam]: progress.startOffset + progress.totalRecords,
    });
  }
  return paramsRequest(strategy, {
    [strategy.pageParam]:
      strategy.firstPage + Math.floor(progress.startOffset / strategy.pageSize) + progress.pages,
    ...sizeParams(strategy.sizeParam, strategy.pageSize),
  });
}

/** The identity of a cursor or URL request, so the same one is never sent twice; `null` for other requests. */
export function visitedKeyOf(strategy: PaginationStrategy, request: PageRequest): string | null {
  if (request.kind === 'url') {
    return request.url;
  }
  if (strategy.kind === 'cursor') {
    return String(request.params[strategy.cursorParam] ?? '');
  }
  return null;
}
