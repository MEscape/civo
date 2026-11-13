import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { definedKeys } from '@lib/utils';

import { isEmptyChanges, parseDatasetChanges } from '../../domain/models/dataset';
import { toDatasetView } from '../data-source-view-mappers';
import { loadAuthorizedDataset } from '../services/load-authorized-dataset';

import type { Dataset } from '../../domain/models/dataset';
import type { UpdateDatasetInput } from '../contracts/data-source-inputs';
import type { DatasetView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../services/load-authorized-dataset';

type UpdateDatasetError = LoadDatasetError | ConflictAppError;

/** Renames a dataset or changes its slug. The mapping has its own flow: `SaveDatasetMapping`. */
export class UpdateDataset {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(input: UpdateDatasetInput): AppResultAsync<DatasetView, UpdateDatasetError> {
    const { datasets, audit } = this.deps;

    return loadAuthorizedDataset(this.deps, input.datasetId, 'dataset.update').andThen(
      ({ scope, dataset }) =>
        parseDatasetChanges(input)
          .asyncAndThen(
            (
              changes,
            ): AppResultAsync<
              Dataset,
              ConflictAppError | NotFoundAppError | InfrastructureAppError
            > => {
              if (isEmptyChanges(changes)) {
                return okAsync(dataset);
              }
              return datasets.update(dataset.id, scope.tenantId, changes).map((updated) => {
                audit.record({
                  type: 'dataset.updated',
                  actorId: scope.actorId,
                  tenantId: scope.tenantId,
                  websiteId: updated.websiteId,
                  datasetId: updated.id,
                  changedFields: definedKeys(changes),
                });
                return updated;
              });
            },
          )
          .map(toDatasetView),
    );
  }
}
