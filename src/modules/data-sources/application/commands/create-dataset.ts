import type { ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createDatasetDraft } from '../../domain/models/dataset';
import { toDatasetView } from '../data-source-view-mappers';
import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';

import type { CreateDatasetInput } from '../contracts/data-source-inputs';
import type { DatasetView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';

type CreateDatasetError = LoadDataSourceError | ConflictAppError;

/**
 * Adds a dataset to a source the actor may configure. The dataset is
 * addressed through its source, so authorization covers the resource that
 * is actually changed. The slug must be unique within the source.
 */
export class CreateDataset {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(input: CreateDatasetInput): AppResultAsync<DatasetView, CreateDatasetError> {
    const { datasets, audit } = this.deps;

    return loadAuthorizedDataSource(this.deps, input.dataSourceId, 'dataset.create').andThen(
      ({ scope, source }) =>
        createDatasetDraft(source.id, input)
          .asyncAndThen((draft) => datasets.create({ tenantId: scope.tenantId, draft }))
          .map((dataset) => {
            audit.record({
              type: 'dataset.created',
              actorId: scope.actorId,
              tenantId: scope.tenantId,
              websiteId: dataset.websiteId,
              dataSourceId: source.id,
              datasetId: dataset.id,
              canonicalKind: dataset.canonicalKind,
            });
            return toDatasetView(dataset);
          }),
    );
  }
}
