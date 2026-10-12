import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  DATA_SOURCE_VALIDATION_CODES as CODES,
  dataSourceValidationFailed,
} from '../errors/data-source-errors';

import { PAGINATION_LIMITS } from './pagination-strategy';

/**
 * Which records of a source a caller wants: `limit` records starting at
 * `offset`. The caller is whoever shows them (a component with the Limit an
 * editor set, a chart the visitor zooms), so the window follows what the
 * screen displays instead of a budget the source guesses for it.
 */
export interface ReadWindow {
  readonly limit: number;
  readonly offset: number;
}

/**
 * Backstops, not budgets: a request outside them is refused. The most records
 * one read can return is what the connector can page through
 * (`maxPages` of `maxPageSize`), so this follows from the connector's own
 * limits and knows nothing about kinds of content.
 */
export const READ_WINDOW_LIMITS = {
  maxLimit: PAGINATION_LIMITS.maxPages * PAGINATION_LIMITS.maxPageSize,
  maxOffset: 1_000_000,
} as const;

function isWholeNumberWithin(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** The only way a window enters the system. */
export function createReadWindow(raw: ReadWindow): AppResult<ReadWindow, ValidationAppError> {
  const isValid =
    isWholeNumberWithin(raw.limit, 1, READ_WINDOW_LIMITS.maxLimit) &&
    isWholeNumberWithin(raw.offset, 0, READ_WINDOW_LIMITS.maxOffset);
  return isValid
    ? ok({ limit: raw.limit, offset: raw.offset })
    : err(dataSourceValidationFailed({ window: [CODES.windowInvalid] }));
}

/** The first `size` records: what discovery, a dry run and a connection test read. */
export function firstRecords(size: number): ReadWindow {
  return { limit: size, offset: 0 };
}
