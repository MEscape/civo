import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedDataset } from '../services/load-authorized-dataset';

import type { DatasetDeletionGuard, DeletionGuardError } from '../contracts/data-removal-inputs';
import type { DatasetRemovalView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../services/load-authorized-dataset';

/**
 * Removes a dataset once the guard confirms no page shows it. The caller
 * also invalidates the builder, whose dataset choices change.
 */
export class DeleteDataset {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    id: string,
    guard: DatasetDeletionGuard,
  ): AppResultAsync<DatasetRemovalView, LoadDatasetError | DeletionGuardError> {
    const { datasets, audit } = this.deps;

    return loadAuthorizedDataset(this.deps, id, 'dataset.delete').andThen(({ scope, dataset }) =>
      guard({ websiteId: dataset.websiteId, datasetIds: [dataset.id] })
        .andThen(() => datasets.deleteById(dataset.id, scope.tenantId))
        .map(() => {
          audit.record({
            type: 'dataset.deleted',
            actorId: scope.actorId,
            tenantId: scope.tenantId,
            websiteId: dataset.websiteId,
            datasetId: dataset.id,
          });
          return { id: dataset.id, websiteId: dataset.websiteId };
        }),
    );
  }
}
