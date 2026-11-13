import type { TenantId } from '@modules/auth';

import { db, createPersistenceFailures, advisoryLock, retryTransient } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { MAX_SETUP_MAPPINGS } from '../../application/data-sources-limits';
import {
  DATA_SOURCE_ERROR_CODES,
  dataSourceNotFound,
  datasetNotFound,
  datasetSlugTaken,
  persistenceFailed,
} from '../../domain/errors/data-source-errors';
import { restoreDatasetMapping } from '../../domain/mapping/dataset-mapping';
import { CANONICAL_KINDS, isCanonicalKind } from '../../domain/models/canonical-kinds';
import { toDatasetId, toWebsiteId } from '../../domain/models/ids';

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
import type { DatasetId, WebsiteId } from '../../domain/models/ids';
import type { DatasetRepository, DatasetSetup } from '../../domain/ports/dataset.repository';

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
  getSetup(
    websiteId: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<DatasetSetup, InfrastructureAppError> {
    const query = () =>
      datasetsOf(tenantId)
        .where((dataset) => dataset.dataSource.some({ websiteId }))
        .where((dataset) => dataset.canonicalKind.in(CANONICAL_KINDS));
    return fromThrowableAsync(async () => {
      const [kinds, mapped] = await Promise.all([
        query()
          .groupBy('canonicalKind')
          .aggregate((a) => ({ count: a.count() })),
        query()
          .where((dataset) => dataset.mapping.isNotNull())
          .select('canonicalKind', 'mapping')
          .orderBy((dataset) => dataset.id.asc())
          .limit(MAX_SETUP_MAPPINGS + 1)
          .all(),
      ]);
      return {
        kinds: kinds.map((row) => row.canonicalKind).filter(isCanonicalKind),
        mappedKinds: unique(
          mapped
            .slice(0, MAX_SETUP_MAPPINGS)
            .flatMap((row) =>
              isCanonicalKind(row.canonicalKind) &&
              restoreDatasetMapping(row.canonicalKind, row.mapping) !== null
                ? [row.canonicalKind]
                : [],
            ),
        ),
        isTruncated: mapped.length > MAX_SETUP_MAPPINGS,
      };
    }, failures.infraOnly('getSetup'));
  }

  findWebsiteId(id: DatasetId): AppResultAsync<WebsiteId | null, InfrastructureAppError> {
    return fromThrowableAsync(
      // @owner-scope derived Only routing metadata; the application authorizes before loading contents.
      async () =>
        db.orm.public.Dataset.where({ id })
          .select('id')
          .include('dataSource', (source) => source.select('websiteId'))
          .first(),
      failures.infraOnly('findWebsiteId'),
    ).map((record) => {
      const websiteId = record?.dataSource?.websiteId;
      return websiteId === undefined ? null : toWebsiteId(websiteId);
    });
  }

  findWithSource(
    id: DatasetId,
    tenantId: TenantId,
  ): AppResultAsync<DatasetWithSource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => ownDatasetsWithSource(tenantId).where({ id }).first(),
      failures.infraOnly('findWithSource'),
    ).map((record) => record && toDatasetWithSource(record, tenantId));
  }

  findNames(
    websiteId: WebsiteId,
    tenantId: TenantId,
    ids: readonly DatasetId[],
  ): AppResultAsync<
    ReadonlyArray<{ readonly id: DatasetId; readonly name: string }>,
    InfrastructureAppError
  > {
    if (ids.length === 0) {
      return okAsync([]);
    }
    return fromThrowableAsync(
      async () =>
        datasetsOf(tenantId)
          .where((dataset) => dataset.id.in([...ids]))
          .where((dataset) => dataset.dataSource.some({ websiteId }))
          .select('id', 'name')
          .limit(ids.length)
          .all(),
      failures.infraOnly('findNames'),
    ).map((records) =>
      records.map((record) => ({ id: toDatasetId(record.id), name: record.name })),
    );
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
  }): AppResultAsync<
    { readonly items: readonly Dataset[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      async () =>
        ownDatasets(tenantId)
          .where((dataset) => dataset.canonicalKind.in(canonicalKinds))
          .where((dataset) => dataset.dataSource.some({ websiteId }))
          .orderBy([(d) => d.name.asc(), (d) => d.id.asc()])
          .limit(limit + 1)
          .all(),
      failures.infraOnly('listCompatible'),
    ).map((records) => ({
      items: toDatasets(records.slice(0, limit), tenantId),
      isTruncated: records.length > limit,
    }));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DatasetDraft;
  }): AppResultAsync<Dataset, ConflictAppError | NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    return fromThrowableAsync(
      () =>
        retryTransient(() =>
          db.transaction(async (tx) => {
            await advisoryLock(tx, `data-source:${draft.dataSourceId}`);
            // The source must exist IN THIS TENANT; otherwise it is "not found".
            const source = await dataSourcesOf(tenantId, tx)
              .where({ id: draft.dataSourceId })
              .select('id')
              .first();
            if (source === null) {
              return null;
            }

            // @owner-scope child The dataset of a source that was just found within this tenant.
            return tx.orm.public.Dataset.select(...DATASET_SELECT)
              .include('dataSource', (parent) => parent.select(...DATA_SOURCE_PARENT_SELECT))
              .create({
                dataSourceId: draft.dataSourceId,
                name: draft.name,
                slug: draft.slug,
                canonicalKind: draft.canonicalKind,
                path: draft.path,
              });
          }),
        ),
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
