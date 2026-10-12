import { fieldPath } from '@lib/errors';
import type { FieldErrorBag } from '@lib/errors';
import { getPath, hasUnsafePathSegment, isPlainObject, literalGuard } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES as CODES } from '../errors/data-source-errors';

export const PAGINATION_KINDS = ['none', 'offset', 'page', 'cursor', 'next-url'] as const;
export type PaginationKind = (typeof PAGINATION_KINDS)[number];
const isPaginationKind = literalGuard(PAGINATION_KINDS);

/** Where a pagination parameter travels: the query string, or the JSON body of a POST. */
export const PARAM_PLACEMENTS = ['query', 'body'] as const;
export type ParamPlacement = (typeof PARAM_PLACEMENTS)[number];
const isParamPlacement = literalGuard(PARAM_PLACEMENTS);

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
export interface ReadStart {
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

const PARAM_NAME_PATTERN = /^[A-Za-z_][\w.[\]-]*$/;

function isParamName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= PAGINATION_LIMITS.maxNameLength &&
    PARAM_NAME_PATTERN.test(value) &&
    !hasUnsafePathSegment(value)
  );
}

function isPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= PAGINATION_LIMITS.maxPathLength &&
    !hasUnsafePathSegment(value)
  );
}

function readPageSize(raw: unknown): number | null {
  const size = raw === undefined ? PAGINATION_LIMITS.defaultPageSize : raw;
  return typeof size === 'number' &&
    Number.isInteger(size) &&
    size >= PAGINATION_LIMITS.minPageSize &&
    size <= PAGINATION_LIMITS.maxPageSize
    ? size
    : null;
}

/** `null`: not set; `undefined`: set but not a valid name. */
function readOptionalName(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  return isParamName(raw) ? raw : undefined;
}

export interface PaginationCheck {
  readonly raw: unknown;
  readonly method: RequestMethod;
  readonly bag: FieldErrorBag;
  readonly at: string;
}

/** The field that made a block invalid. */
interface Rejected {
  readonly field: string;
}

function isRejected(value: CommonSettings | PaginationStrategy | Rejected): value is Rejected {
  return 'field' in value;
}

interface CommonSettings {
  readonly placement: ParamPlacement;
  readonly pageSize: number;
}

type RawBlock = Readonly<Record<string, unknown>>;

/** Where parameters go and how many records a page holds: shared by the strategies that send parameters. */
function readCommon(raw: RawBlock, method: RequestMethod): CommonSettings | Rejected {
  const placement = raw['placement'] === undefined ? 'query' : raw['placement'];
  // Parameters in the body need a POST to carry them.
  if (typeof placement !== 'string' || !isParamPlacement(placement)) {
    return { field: 'placement' };
  }
  if (placement === 'body' && method !== 'POST') {
    return { field: 'placement' };
  }
  const pageSize = readPageSize(raw['pageSize']);
  return pageSize === null ? { field: 'pageSize' } : { placement, pageSize };
}

function readOffset(raw: RawBlock, common: CommonSettings): PaginationStrategy | Rejected {
  const { limitParam, offsetParam } = raw;
  if (!isParamName(limitParam)) {
    return { field: 'limitParam' };
  }
  if (!isParamName(offsetParam)) {
    return { field: 'offsetParam' };
  }
  return { kind: 'offset', limitParam, offsetParam, ...common };
}

function readPage(raw: RawBlock, common: CommonSettings): PaginationStrategy | Rejected {
  const { pageParam } = raw;
  const sizeParam = readOptionalName(raw['sizeParam']);
  const firstPage = raw['firstPage'] === undefined ? 1 : raw['firstPage'];
  if (!isParamName(pageParam)) {
    return { field: 'pageParam' };
  }
  if (sizeParam === undefined) {
    return { field: 'sizeParam' };
  }
  if (typeof firstPage !== 'number' || !Number.isInteger(firstPage) || firstPage < 0) {
    return { field: 'firstPage' };
  }
  return { kind: 'page', pageParam, sizeParam, firstPage, ...common };
}

function readCursor(raw: RawBlock, common: CommonSettings): PaginationStrategy | Rejected {
  const { cursorParam, nextCursorPath } = raw;
  const sizeParam = readOptionalName(raw['sizeParam']);
  if (!isParamName(cursorParam)) {
    return { field: 'cursorParam' };
  }
  if (!isPath(nextCursorPath)) {
    return { field: 'nextCursorPath' };
  }
  if (sizeParam === undefined) {
    return { field: 'sizeParam' };
  }
  return { kind: 'cursor', cursorParam, nextCursorPath, sizeParam, ...common };
}

function readNextUrl(raw: RawBlock): PaginationStrategy | Rejected {
  const { nextUrlPath } = raw;
  return isPath(nextUrlPath) ? { kind: 'next-url', nextUrlPath } : { field: 'nextUrlPath' };
}

const PARAMETER_READERS = {
  offset: readOffset,
  page: readPage,
  cursor: readCursor,
} as const;

function readStrategy(
  kind: Exclude<PaginationKind, 'none'>,
  raw: RawBlock,
  method: RequestMethod,
): PaginationStrategy | Rejected {
  if (kind === 'next-url') {
    return readNextUrl(raw);
  }
  const common = readCommon(raw, method);
  return isRejected(common) ? common : PARAMETER_READERS[kind](raw, common);
}

/**
 * Validates a raw pagination block and returns the strategy only when every
 * field is sound; the first problem is added to `bag` under `<at>.<field>`.
 * `method` is the request method of the source.
 */
export function checkPaginationStrategy({
  raw,
  method,
  bag,
  at,
}: PaginationCheck): PaginationStrategy | null {
  if (raw === undefined || raw === null) {
    return NO_PAGINATION;
  }
  if (!isPlainObject(raw)) {
    bag.add(at, CODES.paginationInvalid);
    return null;
  }

  const kind = raw['kind'];
  if (typeof kind !== 'string' || !isPaginationKind(kind)) {
    bag.add(fieldPath(at, 'kind'), CODES.paginationInvalid);
    return null;
  }
  if (kind === 'none') {
    return NO_PAGINATION;
  }

  const strategy = readStrategy(kind, raw, method);
  if (isRejected(strategy)) {
    bag.add(fieldPath(at, strategy.field), CODES.paginationInvalid);
    return null;
  }
  return strategy;
}
