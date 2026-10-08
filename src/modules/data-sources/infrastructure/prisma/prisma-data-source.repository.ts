import type { TenantId } from '@modules/auth';

import { db, createPersistenceFailures, dateToInstant } from '@lib/db';
import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  DATA_SOURCE_ERROR_CODES,
  dataSourceNotFound,
  websiteNotFoundForDataSource,
} from '../../domain/errors/data-source-errors';

import {
  DATA_SOURCE_SELECT,
  toDataSource,
  toDataSourceWithDatasets,
} from './data-source-record-mapper';
import { DATASET_SELECT } from './dataset-record-mapper';
import { dataSourcesOf } from './tenant-ownership';

import type { DataSource, DataSourceDraft } from '../../domain/models/data-source';
import type { DataSourceId, WebsiteId } from '../../domain/models/ids';
import type {
  DataSourceRepository,
  DataSourceWithDatasets,
  TestOutcome,
} from '../../domain/ports/data-source.repository';

const failures = createPersistenceFailures({
  module: 'data-source.persistence',
  code: DATA_SOURCE_ERROR_CODES.persistenceFailed,
  subject: 'DataSource',
});

/** The tenant's sources, narrowed to what the mapper reads. */
const ownSources = (tenantId: TenantId) => dataSourcesOf(tenantId).select(...DATA_SOURCE_SELECT);

/**
 * Prisma 8 repository for data sources.
 *
 * A source has no tenant column, so every query starts from
 * `dataSourcesOf(tenantId)`, which scopes it through the website INSIDE the
 * statement (see `tenant-ownership.ts`). Rows of another tenant are never
 * read or written, so nothing is filtered afterwards and the tenant the
 * mapper puts on the result is the one that was asked for.
 *
 * Failure conventions (see `createPersistenceFailures`):
 * - reads and idempotent deletes -> `infraOnly`
 * - single-row writes -> `infraOnly` followed by `requireRow` (Prisma 8
 *   `update()` resolves to `null` on a miss; a row outside the tenant is a
 *   miss)
 */
export class PrismaDataSourceRepository implements DataSourceRepository {
  findById(
    id: DataSourceId,
    tenantId: TenantId,
  ): AppResultAsync<DataSource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => ownSources(tenantId).where({ id }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toDataSource(record, tenantId));
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly DataSource[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ownSources(tenantId)
          .where({ websiteId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(s) => s.createdAt.asc(), (s) => s.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).map((records) => records.map((record) => toDataSource(record, tenantId)));
  }

  listWithDatasets(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limits: { readonly sources: number; readonly datasetsPerSource: number },
  ): AppResultAsync<readonly DataSourceWithDatasets[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ownSources(tenantId)
          .where({ websiteId })
          .include('datasets', (datasets) =>
            datasets
              .select(...DATASET_SELECT)
              .orderBy([(d) => d.name.asc(), (d) => d.id.asc()])
              .limit(limits.datasetsPerSource),
          )
          .orderBy([(s) => s.createdAt.asc(), (s) => s.id.asc()])
          .limit(limits.sources)
          .all(),
      failures.infraOnly('listWithDatasets'),
    ).map((records) => records.map((record) => toDataSourceWithDatasets(record, tenantId)));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DataSourceDraft;
  }): AppResultAsync<DataSource, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    return fromThrowableAsync(async () => {
      // The website must exist IN THIS TENANT; otherwise it is "not found".
      const website = await db.orm.public.Website.where({
        id: draft.websiteId,
        tenantId,
      })
        .select('id')
        .first();
      if (website === null) {
        return null;
      }

      return db.orm.public.DataSource.select(...DATA_SOURCE_SELECT).create({
        websiteId: draft.websiteId,
        name: draft.name,
        kind: draft.kind,
        config: draft.config,
      });
    }, failures.infraOnly('create'))
      .andThen(failures.requireRow(websiteNotFoundForDataSource))
      .map((record) => toDataSource(record, tenantId));
  }

  /** Idempotent. The source's datasets go with it (foreign-key cascade). */
  deleteById(id: DataSourceId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => dataSourcesOf(tenantId).where({ id }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }

  recordTestResult(
    id: DataSourceId,
    tenantId: TenantId,
    outcome: TestOutcome,
  ): AppResultAsync<void, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        dataSourcesOf(tenantId)
          .where({ id })
          .select('id')
          .update({
            status: outcome.status,
            lastError: outcome.errorCode,
            lastCheckedAt: dateToInstant(outcome.checkedAt),
          }),
      failures.infraOnly('recordTestResult'),
    )
      .andThen(failures.requireRow(dataSourceNotFound))
      .map(() => undefined);
  }
}
