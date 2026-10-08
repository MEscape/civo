import type { TenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { isDefined } from '@lib/utils';

import { isDataSourceKind, isDataSourceStatus } from '../../domain/models/data-source-kinds';
import { toDataSourceId, toWebsiteId } from '../../domain/models/ids';

import { buildDataset, toParent } from './dataset-record-mapper';

import type { DatasetColumnsRecord } from './dataset-record-mapper';
import type { DataSource } from '../../domain/models/data-source';
import type { DataSourceKind, DataSourceStatus } from '../../domain/models/data-source-kinds';
import type { DataSourceWithDatasets } from '../../domain/ports/data-source.repository';

export interface TenantRecord {
  readonly tenantId: string;
}

export interface DataSourceRecord {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly kind: string;
  readonly config: unknown;
  readonly status: string;
  readonly lastCheckedAt: InstantRecord | null;
  readonly lastError: string | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/** A source read together with some of its datasets. */
export interface DataSourceWithDatasetsRecord extends DataSourceRecord {
  readonly datasets: readonly DatasetColumnsRecord[];
}

export const DATA_SOURCE_SELECT = [
  'id',
  'websiteId',
  'name',
  'kind',
  'config',
  'status',
  'lastCheckedAt',
  'lastError',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof DataSourceRecord>;

export function toKind(raw: string): DataSourceKind {
  return isDataSourceKind(raw) ? raw : 'MOCK';
}

export function toStatus(raw: string): DataSourceStatus {
  return isDataSourceStatus(raw) ? raw : 'UNKNOWN';
}

export function toDataSource(record: DataSourceRecord, tenantId: TenantId): DataSource {
  return {
    id: toDataSourceId(record.id),
    tenantId,
    websiteId: toWebsiteId(record.websiteId),
    name: record.name,
    kind: toKind(record.kind),
    config: record.config,
    status: toStatus(record.status),
    lastCheckedAt: record.lastCheckedAt ? instantToDate(record.lastCheckedAt) : null,
    lastErrorCode: record.lastError,
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/** A source with its datasets; unusable datasets are left out. */
export function toDataSourceWithDatasets(
  record: DataSourceWithDatasetsRecord,
  tenantId: TenantId,
): DataSourceWithDatasets {
  const parent = toParent(record, tenantId);
  return {
    source: toDataSource(record, tenantId),
    datasets: record.datasets.map((columns) => buildDataset(columns, parent)).filter(isDefined),
  };
}
