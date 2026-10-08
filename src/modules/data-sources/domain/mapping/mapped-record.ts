import { getPath, isPlainObject, stableStringify } from '@lib/utils';

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
  /** True when the response held more records than `MAX_MAPPED_RECORDS`. */
  readonly truncated: boolean;
}

/** Avoids unbounded in-memory processing of a large external response. */
export const MAX_MAPPED_RECORDS = 1000;

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

/** A GeoJSON FeatureCollection is a list of its features, so open-data GeoJSON endpoints map like any array. */
function geoJsonFeatures(body: unknown): readonly unknown[] | null {
  if (!isPlainObject(body) || body['type'] !== 'FeatureCollection') {
    return null;
  }
  const features = body['features'];
  return Array.isArray(features) ? features : null;
}

/**
 * A top-level array (or a GeoJSON FeatureCollection) is a list of records;
 * any other body is a single record; empty or null yields none. The one
 * place this rule lives: mapping and discovery both read it.
 */
export function toRecordList(body: unknown): readonly unknown[] {
  if (Array.isArray(body)) {
    return body;
  }
  const features = geoJsonFeatures(body);
  if (features !== null) {
    return features;
  }
  return body === null || body === undefined ? [] : [body];
}

/** Maps every record of a response, skipping (and counting) the ones that do not fit. */
export function mapRecords(
  mapping: DatasetMapping,
  body: unknown,
  hash: TextHasher,
): MappedRecords {
  const all = toRecordList(body);
  const records: MappedRecord[] = [];
  let skipped = 0;

  for (const raw of all.slice(0, MAX_MAPPED_RECORDS)) {
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
  return { records, skipped, truncated: all.length > MAX_MAPPED_RECORDS };
}
