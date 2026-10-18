import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedDataset } from '../load-authorized-dataset';

import type { DatasetRemovalView } from '../contracts/data-source-views';
import type { DatasetDeletionGuard, DeletionGuardError } from '../contracts/deletion-inputs';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';

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

    return loadAuthorizedDataset(this.deps, id, 'dataset.delete').andThen(({ actor, dataset }) =>
      guard({ websiteId: dataset.websiteId, datasetIds: [dataset.id] })
        .andThen(() => datasets.deleteById(dataset.id, actor.tenantId))
        .map(() => {
          audit.record({
            type: 'dataset.deleted',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: dataset.websiteId,
            datasetId: dataset.id,
          });
          return { id: dataset.id, websiteId: dataset.websiteId };
        }),
    );
  }
}
