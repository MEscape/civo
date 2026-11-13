import { dateToInstant, instantToDate as recordToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { asInstant, instantFromDate, instantToDate } from '../../domain/time/instant';

import type { Instant } from '../../domain/time/instant';

/** An instant of the rules as the database client wants it for a write. */
export const toRecordInstant = (instant: Instant) => dateToInstant(instantToDate(instant));

/** A stored instant as the rules' `Instant`; `null` when it lies outside the years the rules support. */
export function readInstant(record: InstantRecord): Instant | null {
  return instantFromDate(recordToDate(record));
}

/**
 * A stored instant that may be absent: `null` stays `null`, and `undefined` says it was present but
 * outside the supported years (so "absent" and "unreadable" are not mixed up).
 */
export function readOptionalInstant(record: InstantRecord | null): Instant | null | undefined {
  return record === null ? null : (readInstant(record) ?? undefined);
}

/** A stored instant in epoch milliseconds, for comparing with the clock without leaving the database client's types. */
export function recordMillis(record: InstantRecord): number {
  return recordToDate(record).getTime();
}

/**
 * The stored instants that read as `version`, `[from, until)`. A version is whole milliseconds, but a
 * row the database stamped itself (a column default, the `set_updated_at` trigger) holds
 * microseconds, so an equality filter would never match it and the row could never be changed.
 */
export function versionWindow(version: Instant) {
  return { from: toRecordInstant(version), until: toRecordInstant(asInstant(version + 1)) };
}
