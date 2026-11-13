import type { TenantId } from '@modules/auth';

import { advisoryLock, db, retryTransient } from '@lib/db';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { MAX_DATASETS_PER_SOURCE } from '../../application/data-sources-limits';
import { dataSourceDeletionIncomplete } from '../../domain/errors/data-source-errors';
import { toDatasetId, toWebsiteId } from '../../domain/models/ids';
import { dataSourcesOf, datasetsOf } from '../prisma/tenant-ownership';

import type { DataSourceId, DatasetId } from '../../domain/models/ids';
import type {
  DatasetDeletionGuard,
  DeletionGuardError,
} from '../../domain/ports/dataset-deletion-guard.port';

interface SourceDeletion {
  readonly id: DataSourceId;
  readonly tenantId: TenantId;
  readonly guard: DatasetDeletionGuard;
}

/**
 * Neighbour readers run before taking a transaction connection. Under the source lock, the exact
 * checked child ids must still match before a cascade is allowed. Dataset creation uses this lock
 * too. This does not lock page/map/release writers; those modules still own reference consistency.
 */
export async function deleteSourceWithDatasets({
  id,
  tenantId,
  guard,
}: SourceDeletion): Promise<AppResult<readonly DatasetId[], DeletionGuardError>> {
  const source = await dataSourcesOf(tenantId).where({ id }).select('websiteId').first();
  if (source === null) {
    return ok([]);
  }
  // Raw ids include malformed children that domain mappers cannot represent.
  const children = await datasetsOf(tenantId)
    .where({ dataSourceId: id })
    .select('id')
    .orderBy((dataset) => dataset.id.asc())
    .limit(MAX_DATASETS_PER_SOURCE + 1)
    .all();
  if (children.length > MAX_DATASETS_PER_SOURCE) {
    return err(dataSourceDeletionIncomplete());
  }
  const datasetIds = children.map((child) => toDatasetId(child.id));
  const allowed = await guard({ websiteId: toWebsiteId(source.websiteId), datasetIds });
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await advisoryLock(tx, `data-source:${id}`);
      const current = await datasetsOf(tenantId, tx)
        .where({ dataSourceId: id })
        .select('id')
        .orderBy((dataset) => dataset.id.asc())
        .limit(MAX_DATASETS_PER_SOURCE + 1)
        .all();
      if (
        current.length !== datasetIds.length ||
        current.some((child, index) => child.id !== datasetIds[index])
      ) {
        return err(dataSourceDeletionIncomplete());
      }
      await dataSourcesOf(tenantId, tx).where({ id }).deleteAndCount();
      return ok(datasetIds);
    }),
  );
}
