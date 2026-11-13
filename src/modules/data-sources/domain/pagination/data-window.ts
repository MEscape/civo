import type { ValidationAppError } from '@lib/errors';
import { err } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import {
  DATA_SOURCE_VALIDATION_CODES,
  dataSourceValidationFailed,
} from '../errors/data-source-errors';

import { createReadWindow, READ_WINDOW_LIMITS } from './read-window';

import type { ReadWindow } from './read-window';

/** Per-binding budgets extend the existing record/bbox window rather than replacing its validation. */
export interface DataWindowPolicy {
  readonly schemaVersion: 1;
  readonly maxRecords: number;
  readonly maxOffset: number;
  readonly orderBy: { readonly field: string; readonly direction: 'asc' | 'desc' } | null;
}

const POLICY_KEYS = ['schemaVersion', 'maxRecords', 'maxOffset', 'orderBy'];
const MAX_FIELD_LENGTH = 200;

export function isDataWindowPolicy(raw: unknown): raw is DataWindowPolicy {
  if (!isPlainObject(raw) || Object.keys(raw).some((key) => !POLICY_KEYS.includes(key))) {
    return false;
  }
  const maxRecords = raw['maxRecords'];
  const maxOffset = raw['maxOffset'];
  return (
    raw['schemaVersion'] === 1 &&
    typeof maxRecords === 'number' &&
    Number.isInteger(maxRecords) &&
    maxRecords > 0 &&
    maxRecords <= READ_WINDOW_LIMITS.maxLimit &&
    typeof maxOffset === 'number' &&
    Number.isInteger(maxOffset) &&
    maxOffset >= 0 &&
    maxOffset <= READ_WINDOW_LIMITS.maxOffset &&
    isOrdering(raw['orderBy'])
  );
}

function isOrdering(raw: unknown): boolean {
  if (raw === null) {
    return true;
  }
  return (
    isPlainObject(raw) &&
    Object.keys(raw).every((key) => key === 'field' || key === 'direction') &&
    typeof raw['field'] === 'string' &&
    /^[A-Za-z][A-Za-z0-9_]*$/.test(raw['field']) &&
    raw['field'].length <= MAX_FIELD_LENGTH &&
    (raw['direction'] === 'asc' || raw['direction'] === 'desc')
  );
}

/** Refuse unsupported request sizes, preserving a chart's previous successful window at the caller. */
export function resolveDataWindow(
  raw: ReadWindow,
  policy?: DataWindowPolicy,
): AppResult<ReadWindow, ValidationAppError> {
  const parsed = createReadWindow(raw);
  if (parsed.isErr() || policy === undefined) {
    return parsed;
  }
  return raw.limit > policy.maxRecords || raw.offset > policy.maxOffset
    ? err(dataSourceValidationFailed({ window: [DATA_SOURCE_VALIDATION_CODES.windowInvalid] }))
    : parsed;
}

/** Canonical UTC instants compare as text. Sorting precedes paging so earlier/later retain their meaning. */
export function orderedWindowRecords<T extends Readonly<Record<string, unknown>>>(
  records: readonly T[],
  policy?: DataWindowPolicy,
): readonly T[] {
  const order = policy?.orderBy;
  if (order === undefined || order === null) {
    return records;
  }
  const direction = order.direction === 'asc' ? 1 : -1;
  return [...records].sort((first, second) => {
    const a = first[order.field];
    const b = second[order.field];
    if (typeof a === 'number' && typeof b === 'number') {
      return (a - b) * direction;
    }
    const firstText = typeof a === 'string' ? a : '';
    const secondText = typeof b === 'string' ? b : '';
    return firstText.localeCompare(secondText) * direction;
  });
}
