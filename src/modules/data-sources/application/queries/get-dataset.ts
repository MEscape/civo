import type { AppResultAsync } from '@lib/result';

import { toDatasetView } from '../data-source-view-mappers';
import { loadAuthorizedDataset } from '../services/load-authorized-dataset';

import type { DatasetView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../services/load-authorized-dataset';

export class GetDataset {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(id: string): AppResultAsync<DatasetView, LoadDatasetError> {
    return loadAuthorizedDataset(this.deps, id, 'dataset.read').map(({ dataset }) =>
      toDatasetView(dataset),
    );
  }
}
