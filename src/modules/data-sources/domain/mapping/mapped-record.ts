import { getPath, stableStringify } from '@lib/utils';

import { locateRecords } from '../pagination/records-locator';

import { applyMapping } from './apply-mapping';

import type { DatasetMapping } from './dataset-mapping';

/** One external record after mapping. `values` is UNVALIDATED canonical data. */
export interface MappedRecord {
  readonly id: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface MappedRecords {
  readonly records: readonly MappedRecord[];
  /** Records that failed their mapping and were left out. */
  readonly skipped: number;
  /** True when the response held more records than the budget allowed. */
  readonly truncated: boolean;
}

const ID_FIELDS = ['id', '_id', 'uuid', 'guid'] as const;
const FALLBACK_ID_LENGTH = 16;

/** Hashing is a platform concern, so the domain receives it as a function. */
export type TextHasher = (text: string) => string;

/**
 * A stable id for a mapped record. An id-like field on the RAW record is
 * preferred (most open-data APIs have one), so the same external record
 * keeps its id across refreshes. Otherwise a hash of the mapped content:
 * stable as long as the record's mapped fields do not change.
 */
export function deriveMappedRecordId(
  raw: unknown,
  mapped: Readonly<Record<string, unknown>>,
  hash: TextHasher,
): string {
  for (const field of ID_FIELDS) {
    const value = getPath(raw, field);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return hash(stableStringify(mapped)).slice(0, FALLBACK_ID_LENGTH);
}

/**
 * The records of a response: its record list (a top-level array, a GeoJSON
 * FeatureCollection or a common envelope, see `locateRecords`), else the body
 * itself as one record; empty or null yields none. Mapping and discovery both
 * read it.
 */
export function toRecordList(body: unknown): readonly unknown[] {
  const located = locateRecords(body);
  if (located !== null) {
    return located;
  }
  return body === null || body === undefined ? [] : [body];
}

export interface MapRecordsInput {
  readonly mapping: DatasetMapping;
  /** The records of the window, plus one when there are more (see `ReadWindow`). */
  readonly body: unknown;
  readonly hash: TextHasher;
  /** How many records the caller shows; the one beyond it only marks the result as cut. */
  readonly limit: number;
}

/** Maps up to `limit` records of a response, skipping and counting the ones that do not fit. */
export function mapRecords({ mapping, body, hash, limit }: MapRecordsInput): MappedRecords {
  const all = toRecordList(body);
  const records: MappedRecord[] = [];
  let skipped = 0;

  for (const raw of all.slice(0, limit)) {
    const mapped = applyMapping(mapping, raw);
    if (mapped.isErr()) {
      skipped += 1;
    } else {
      records.push({
        id: deriveMappedRecordId(raw, mapped.value, hash),
        values: mapped.value,
      });
    }
  }
  return { records, skipped, truncated: all.length > limit };
}
