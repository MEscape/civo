import type { FieldErrorBag } from '@lib/errors';
import { isJsonRecord, isPlainObject, jsonWeight } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES } from '../errors/data-source-errors';
import { isDataProvenance } from '../models/data-provenance';
import { isDataWindowPolicy } from '../pagination/data-window';

import type { DataProvenance } from '../models/data-provenance';
import type { DataWindowPolicy } from '../pagination/data-window';

export const SNAPSHOT_LIMITS = { records: 10_000, weight: 5_000_000, depth: 12 } as const;
const KEYS = ['schemaVersion', 'records', 'provenance', 'windowPolicy'];

/** Stored JSON version 1; legacy MOCK {} remains readable as an unavailable provider. */
export interface SnapshotSourceConfig {
  readonly schemaVersion: 1;
  readonly records: ReadonlyArray<Readonly<Record<string, JsonValue>>>;
  readonly provenance: DataProvenance;
  readonly windowPolicy?: DataWindowPolicy;
}

export function readSnapshotSourceConfig(raw: unknown): SnapshotSourceConfig | null {
  if (
    !isPlainObject(raw) ||
    raw['schemaVersion'] !== 1 ||
    Object.keys(raw).some((key) => !KEYS.includes(key))
  ) {
    return null;
  }
  const records = readSnapshotRecords(raw['records']);
  const provenance = raw['provenance'];
  const windowPolicy = raw['windowPolicy'];
  if (windowPolicy !== undefined && !isDataWindowPolicy(windowPolicy)) {
    return null;
  }
  if (records === null || !isDataProvenance(provenance) || provenance.kind === 'live') {
    return null;
  }
  return {
    schemaVersion: 1,
    records,
    provenance,
    ...(windowPolicy === undefined ? {} : { windowPolicy }),
  };
}

function readSnapshotRecords(
  records: unknown,
): ReadonlyArray<Readonly<Record<string, JsonValue>>> | null {
  if (!Array.isArray(records) || records.length > SNAPSHOT_LIMITS.records) {
    return null;
  }
  const checked: Array<Readonly<Record<string, JsonValue>>> = [];
  let weight = 0;
  for (const record of records) {
    if (!isJsonRecord(record, SNAPSHOT_LIMITS.depth)) {
      return null;
    }
    weight += jsonWeight(record);
    if (weight > SNAPSHOT_LIMITS.weight) {
      return null;
    }
    checked.push(record);
  }
  return checked;
}

/** Existing {} is preserved; arbitrary MOCK keys continue to fail validation. */
export function checkSnapshotSourceConfig(
  raw: unknown,
  bag: FieldErrorBag,
): Readonly<Record<string, JsonValue>> | null {
  if (isPlainObject(raw) && Object.keys(raw).length === 0) {
    return {};
  }
  if (readSnapshotSourceConfig(raw) !== null && isJsonRecord(raw, SNAPSHOT_LIMITS.depth + 2)) {
    return raw;
  }
  bag.add('config', DATA_SOURCE_VALIDATION_CODES.configInvalid);
  return null;
}
