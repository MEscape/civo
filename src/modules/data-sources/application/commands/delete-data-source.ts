import type { AppResultAsync } from '@lib/result';

import { MAX_DATASETS_PER_SOURCE } from '../list-limits';
import { loadAuthorizedDataSource } from '../load-authorized-data-source';

import type { DataSourceRemovalView } from '../contracts/data-source-views';
import type { DatasetDeletionGuard, DeletionGuardError } from '../contracts/deletion-inputs';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../load-authorized-data-source';

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
    const { dataSources, datasets, audit } = this.deps;

    return loadAuthorizedDataSource(this.deps, id, 'datasource.delete').andThen(
      ({ actor, source }) =>
        datasets
          .listByDataSource(source.id, actor.tenantId, MAX_DATASETS_PER_SOURCE)
          .andThen((removed) =>
            guard({ websiteId: source.websiteId, datasetIds: removed.map((dataset) => dataset.id) })
              .andThen(() => dataSources.deleteById(source.id, actor.tenantId))
              .map(() => {
                audit.record({
                  type: 'data_source.deleted',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  websiteId: source.websiteId,
                  dataSourceId: source.id,
                });
                return {
                  id: source.id,
                  websiteId: source.websiteId,
                  removedDatasetIds: removed.map((dataset) => dataset.id),
                };
              }),
          ),
    );
  }
}
