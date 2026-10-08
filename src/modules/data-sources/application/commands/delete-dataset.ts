import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedDataset } from '../load-authorized-dataset';

import type { DatasetRemovalView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';

/**
 * Removes a dataset. Components bound to it fall back to sample data, which
 * is why the caller also invalidates the builder.
 */
export class DeleteDataset {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(id: string): AppResultAsync<DatasetRemovalView, LoadDatasetError> {
    const { datasets, audit } = this.deps;

    return loadAuthorizedDataset(this.deps, id, 'dataset.delete').andThen(({ actor, dataset }) =>
      datasets.deleteById(dataset.id, actor.tenantId).map(() => {
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
