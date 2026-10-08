import { toTenantId } from '@modules/auth';
import type { TenantId } from '@modules/auth';

import { instantToDate, type InstantRecord } from '@lib/db';
import { logger } from '@lib/logger';
import { assertNever, isDefined } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { restoreDatasetMapping } from '../../domain/mapping/dataset-mapping';
import { isCanonicalKind } from '../../domain/models/canonical-kinds';
import { toDataSourceId, toDatasetId, toWebsiteId } from '../../domain/models/ids';

import { toDataSource, toKind, toStatus } from './data-source-record-mapper';

import type { DataSourceRecord, TenantRecord } from './data-source-record-mapper';
import type { DatasetMapping, TransformDefinition } from '../../domain/mapping/dataset-mapping';
import type { CanonicalKind } from '../../domain/models/canonical-kinds';
import type { Dataset, DatasetSource, DatasetWithSource } from '../../domain/models/dataset';

const log = logger.withContext({ module: 'data-source.persistence' });

export type DatasetParentRecord = Pick<
  DataSourceRecord,
  'id' | 'websiteId' | 'name' | 'kind' | 'status'
>;

export interface DatasetColumnsRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly canonicalKind: string;
  readonly mapping: unknown;
  readonly status: string;
  readonly lastFetchedAt: InstantRecord | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/** A dataset read with only the parent fields a display needs. */
export interface DatasetRecord extends DatasetColumnsRecord {
  readonly dataSource: DatasetParentRecord | null;
}

/** A dataset read together with its complete parent source. */
export interface DatasetWithSourceRecord extends DatasetColumnsRecord {
  readonly dataSource: DataSourceRecord | null;
}

/** Same, plus the tenant: for the one lookup that is scoped by website, not by tenant. */
export interface DatasetWithSourceAndTenantRecord extends DatasetColumnsRecord {
  readonly dataSource:
    | (DataSourceRecord & {
        readonly website: TenantRecord | null;
      })
    | null;
}

/**
 * Field lists for `.select(...)`, spread at the call site. `satisfies`
 * keeps each list in sync with its record shape.
 */
export const DATA_SOURCE_PARENT_SELECT = [
  'id',
  'websiteId',
  'name',
  'kind',
  'status',
] as const satisfies ReadonlyArray<keyof DatasetParentRecord>;

export const DATASET_SELECT = [
  'id',
  'name',
  'slug',
  'canonicalKind',
  'mapping',
  'status',
  'lastFetchedAt',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof DatasetColumnsRecord>;

export interface DatasetParent {
  readonly source: DatasetSource;
  readonly websiteId: Dataset['websiteId'];
  readonly tenantId: Dataset['tenantId'];
}

export function toParent(record: DatasetParentRecord, tenantId: TenantId): DatasetParent {
  return {
    source: {
      id: toDataSourceId(record.id),
      name: record.name,
      kind: toKind(record.kind),
      status: toStatus(record.status),
    },
    websiteId: toWebsiteId(record.websiteId),
    tenantId,
  };
}

/**
 * A stored mapping is untrusted JSON: the domain rebuilds it through
 * `restoreDatasetMapping`, so every invariant holds again. One that no
 * longer validates reads as "no mapping" (so the dataset falls back to
 * sample data and can be re-mapped) and is reported once.
 */
function restoreMapping(
  stored: unknown,
  canonicalKind: CanonicalKind,
  datasetId: string,
): DatasetMapping | null {
  if (stored === null || stored === undefined) {
    return null;
  }

  const mapping = restoreDatasetMapping(canonicalKind, stored);
  if (mapping === null) {
    log.warn('Stored dataset mapping is no longer valid and was ignored', {
      datasetId,
    });
  }
  return mapping;
}

/**
 * `null` when the stored canonical kind is no longer known (a kind that was
 * removed from the code): such a dataset cannot be used, so it is left out
 * instead of being cast into a kind it does not have.
 */
export function buildDataset(columns: DatasetColumnsRecord, parent: DatasetParent): Dataset | null {
  if (!isCanonicalKind(columns.canonicalKind)) {
    log.warn('Dataset has an unknown canonical kind and was left out', {
      datasetId: columns.id,
    });
    return null;
  }
  return {
    id: toDatasetId(columns.id),
    tenantId: parent.tenantId,
    websiteId: parent.websiteId,
    source: parent.source,
    name: columns.name,
    slug: columns.slug,
    canonicalKind: columns.canonicalKind,
    mapping: restoreMapping(columns.mapping, columns.canonicalKind, columns.id),
    status: toStatus(columns.status),
    lastFetchedAt: columns.lastFetchedAt ? instantToDate(columns.lastFetchedAt) : null,
    createdAt: instantToDate(columns.createdAt),
    updatedAt: instantToDate(columns.updatedAt),
  };
}

export function toDataset(record: DatasetRecord, tenantId: TenantId): Dataset | null {
  if (!record.dataSource) {
    return null;
  }
  return buildDataset(record, toParent(record.dataSource, tenantId));
}

export function toDatasets(
  records: readonly DatasetRecord[],
  tenantId: TenantId,
): readonly Dataset[] {
  return records.map((record) => toDataset(record, tenantId)).filter(isDefined);
}

export function toDatasetWithSource(
  record: DatasetWithSourceRecord,
  tenantId: TenantId,
): DatasetWithSource | null {
  if (!record.dataSource) {
    return null;
  }
  const dataset = toDataset(record, tenantId);
  return dataset ? { dataset, source: toDataSource(record.dataSource, tenantId) } : null;
}

/** For the lookup that has no actor: the tenant is read from the website. */
export function toDatasetWithSourceInWebsite(
  record: DatasetWithSourceAndTenantRecord,
): DatasetWithSource | null {
  if (!record.dataSource?.website) {
    return null;
  }
  return toDatasetWithSource(record, toTenantId(record.dataSource.website.tenantId));
}

function toTransformJson(transform: TransformDefinition): JsonValue {
  switch (transform.kind) {
    case 'join':
      return {
        kind: 'join',
        sourcePaths: [...transform.sourcePaths],
        separator: transform.separator,
      };
    case 'fallback':
      return { kind: 'fallback', value: transform.value };

    case 'string':
    case 'number':
    case 'boolean':
    case 'url':
    case 'date':
    case 'datetime':
      return { kind: transform.kind };

    default:
      return assertNever(transform);
  }
}

/**
 * The JSON stored for a mapping: plain mutable data, the inverse of
 * `restoreMapping`. `required` is not stored: the domain derives it again
 * from the canonical kind on every read.
 */
export function toMappingJson(mapping: DatasetMapping): JsonValue {
  return {
    fields: mapping.fields.map((field) => ({
      sourcePath: field.sourcePath,
      targetPath: field.targetPath,
      ...(field.transform ? { transform: toTransformJson(field.transform) } : {}),
    })),
  };
}
