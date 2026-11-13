import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';

import type { DatasetDeletionGuard, DeletionGuardError } from '../contracts/data-removal-inputs';
import type { DataSourceRemovalView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';

/**
 * Removes a source together with its datasets. The ids of those datasets
 * are returned because deleting them is a mutation that must invalidate
 * every cache derived from them (caching.md); the caller cannot know them
 * after the fact. Nothing is removed while the guard says a page shows one.
 */
export class DeleteDataSource {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    id: string,
    guard: DatasetDeletionGuard,
  ): AppResultAsync<DataSourceRemovalView, LoadDataSourceError | DeletionGuardError> {
    const { dataSources, audit } = this.deps;

    return loadAuthorizedDataSource(this.deps, id, 'datasource.delete').andThen(
      ({ scope, source }) =>
        dataSources.deleteGuarded(source.id, scope.tenantId, guard).map((removedDatasetIds) => {
          audit.record({
            type: 'data_source.deleted',
            actorId: scope.actorId,
            tenantId: scope.tenantId,
            websiteId: source.websiteId,
            dataSourceId: source.id,
          });
          return {
            id: source.id,
            websiteId: source.websiteId,
            removedDatasetIds,
          };
        }),
    );
  }
}
