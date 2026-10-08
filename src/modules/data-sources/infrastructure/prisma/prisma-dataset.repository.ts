import type { TenantId } from '@modules/auth';

import { db, createPersistenceFailures } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  DATA_SOURCE_ERROR_CODES,
  dataSourceNotFound,
  datasetNotFound,
  datasetSlugTaken,
  persistenceFailed,
} from '../../domain/errors/data-source-errors';

import { DATA_SOURCE_SELECT } from './data-source-record-mapper';
import {
  DATASET_SELECT,
  DATA_SOURCE_PARENT_SELECT,
  toDataset,
  toDatasetWithSource,
  toDatasetWithSourceInWebsite,
  toDatasets,
  toMappingJson,
} from './dataset-record-mapper';
import { dataSourcesOf, datasetsOf } from './tenant-ownership';

import type { DatasetRecord } from './dataset-record-mapper';
import type { DatasetMapping } from '../../domain/mapping/dataset-mapping';
import type { CanonicalKind } from '../../domain/models/canonical-kinds';
import type {
  Dataset,
  DatasetChanges,
  DatasetDraft,
  DatasetWithSource,
} from '../../domain/models/dataset';
import type { DataSourceId, DatasetId, WebsiteId } from '../../domain/models/ids';
import type { DatasetRepository } from '../../domain/ports/dataset.repository';

const failures = createPersistenceFailures({
  module: 'data-source.persistence',
  code: DATA_SOURCE_ERROR_CODES.persistenceFailed,
  subject: 'Dataset',
});

/** The tenant's datasets with the light parent fields a display needs. */
const ownDatasets = (tenantId: TenantId) =>
  datasetsOf(tenantId)
    .select(...DATASET_SELECT)
    .include('dataSource', (source) => source.select(...DATA_SOURCE_PARENT_SELECT));

/** The tenant's datasets with their COMPLETE parent source, for operations that call the external system. */
const ownDatasetsWithSource = (tenantId: TenantId) =>
  datasetsOf(tenantId)
    .select(...DATASET_SELECT)
    .include('dataSource', (source) => source.select(...DATA_SOURCE_SELECT));

/**
 * Prisma 8 repository for datasets.
 *
 * Every tenant-scoped query starts from `datasetsOf(tenantId)`, which scopes
 * it through the source and its website INSIDE the statement (see
 * `tenant-ownership.ts`). The exception is `findWithSourceInWebsite`, which
 * is scoped by WEBSITE because a visitor has no actor.
 *
 * Failure conventions (see `createPersistenceFailures`):
 * - reads and idempotent deletes -> `infraOnly`
 * - writes that can hit the slug's unique constraint -> `orConflict`
 * - single-row writes -> `requireRow` (Prisma 8 `update()` resolves to
 *   `null` on a miss; a row outside the tenant is a miss)
 */
export class PrismaDatasetRepository implements DatasetRepository {
  findWithSource(
    id: DatasetId,
    tenantId: TenantId,
  ): AppResultAsync<DatasetWithSource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => ownDatasetsWithSource(tenantId).where({ id }).first(),
      failures.infraOnly('findWithSource'),
    ).map((record) => record && toDatasetWithSource(record, tenantId));
  }

  findWithSourceInWebsite(
    id: DatasetId,
    websiteId: WebsiteId,
  ): AppResultAsync<DatasetWithSource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        // No actor, so no tenant to scope by: the tenant is read from the
        // website instead, and the dataset must belong to `websiteId`.
        db.orm.public.Dataset.select(...DATASET_SELECT)
          .include('dataSource', (source) =>
            source
              .select(...DATA_SOURCE_SELECT)
              .include('website', (website) => website.select('tenantId')),
          )
          .where({ id })
          .where((dataset) => dataset.dataSource.some({ websiteId }))
          .first(),
      failures.infraOnly('findWithSourceInWebsite'),
    ).map((record) => record && toDatasetWithSourceInWebsite(record));
  }

  listByDataSource(
    dataSourceId: DataSourceId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly Dataset[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ownDatasets(tenantId)
          .where({ dataSourceId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(d) => d.name.asc(), (d) => d.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByDataSource'),
    ).map((records) => toDatasets(records, tenantId));
  }

  /**
   * One query over the datasets of the website's sources, filtered to the
   * kind. The website filter is part of the query, so datasets of other
   * websites can never use up the limit.
   */
  listCompatible({
    websiteId,
    tenantId,
    canonicalKinds,
    limit,
  }: {
    readonly websiteId: WebsiteId;
    readonly tenantId: TenantId;
    readonly canonicalKinds: readonly CanonicalKind[];
    readonly limit: number;
  }): AppResultAsync<readonly Dataset[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ownDatasets(tenantId)
          .where((dataset) => dataset.canonicalKind.in(canonicalKinds))
          .where((dataset) => dataset.dataSource.some({ websiteId }))
          .orderBy([(d) => d.name.asc(), (d) => d.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listCompatible'),
    ).map((records) => toDatasets(records, tenantId));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DatasetDraft;
  }): AppResultAsync<Dataset, ConflictAppError | NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    return fromThrowableAsync(
      async () => {
        // The source must exist IN THIS TENANT; otherwise it is "not found".
        const source = await dataSourcesOf(tenantId)
          .where({ id: draft.dataSourceId })
          .select('id')
          .first();
        if (source === null) {
          return null;
        }

        return db.orm.public.Dataset.select(...DATASET_SELECT)
          .include('dataSource', (parent) => parent.select(...DATA_SOURCE_PARENT_SELECT))
          .create({
            dataSourceId: draft.dataSourceId,
            name: draft.name,
            slug: draft.slug,
            canonicalKind: draft.canonicalKind,
          });
      },
      failures.orConflict('create', datasetSlugTaken),
    )
      .andThen(failures.requireRow(dataSourceNotFound))
      .andThen((record) => present(record, tenantId));
  }

  update(
    id: DatasetId,
    tenantId: TenantId,
    changes: DatasetChanges,
  ): AppResultAsync<Dataset, ConflictAppError | NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () => ownDatasets(tenantId).where({ id }).update(changes),
      failures.orConflict('update', datasetSlugTaken),
    )
      .andThen(failures.requireRow(datasetNotFound))
      .andThen((record) => present(record, tenantId));
  }

  /** Also resets the status and the fetch time: a new mapping changes what data is valid. */
  saveMapping(
    id: DatasetId,
    tenantId: TenantId,
    mapping: DatasetMapping,
  ): AppResultAsync<Dataset, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ownDatasets(tenantId)
          .where({ id })
          .update({
            mapping: toMappingJson(mapping),
            status: 'UNKNOWN',
            lastFetchedAt: null,
          }),
      failures.infraOnly('saveMapping'),
    )
      .andThen(failures.requireRow(datasetNotFound))
      .andThen((record) => present(record, tenantId));
  }

  deleteById(id: DatasetId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => datasetsOf(tenantId).where({ id }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}

/** A row we just wrote but cannot represent (unknown canonical kind) is a storage inconsistency. */
function present(
  record: DatasetRecord,
  tenantId: TenantId,
): AppResultAsync<Dataset, InfrastructureAppError> {
  const dataset = toDataset(record, tenantId);
  return dataset
    ? okAsync(dataset)
    : errAsync(persistenceFailed('Stored dataset has an unknown canonical kind.'));
}
