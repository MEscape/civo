import { fieldPath } from '@lib/errors';
import type { FieldErrorBag } from '@lib/errors';
import { hasUnsafePathSegment, isPlainObject, literalGuard } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES as CODES } from '../errors/data-source-errors';

import {
  NO_PAGINATION,
  PAGINATION_KINDS,
  PAGINATION_LIMITS,
  PARAM_PLACEMENTS,
} from './pagination-strategy';

import type {
  PaginationKind,
  PaginationStrategy,
  ParamPlacement,
  RequestMethod,
} from './pagination-strategy';

const isPaginationKind = literalGuard(PAGINATION_KINDS);
const isParamPlacement = literalGuard(PARAM_PLACEMENTS);

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

interface PaginationCheck {
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
