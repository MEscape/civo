import type { AppResultAsync } from '@lib/result';

import { createDatasetMapping } from '../../domain/mapping/dataset-mapping';
import { loadAuthorizedDataset } from '../load-authorized-dataset';
import { dryRunMapping } from '../services/dry-run-mapping';

import type {
  MappingPreviewView,
  PreviewDatasetMappingInput,
} from '../contracts/data-source-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';
import type { DryRunError } from '../services/dry-run-mapping';

/** Applies a candidate mapping to one live record without saving it. */
export class PreviewDatasetMapping {
  constructor(private readonly deps: ConnectedDataSourceDependencies) {}

  execute(
    input: PreviewDatasetMappingInput,
  ): AppResultAsync<MappingPreviewView, LoadDatasetError | DryRunError> {
    return loadAuthorizedDataset(this.deps, input.datasetId, 'dataset.map').andThen(
      ({ dataset, source }) =>
        createDatasetMapping(dataset.canonicalKind, input.mapping)
          .asyncAndThen((mapping) => dryRunMapping(this.deps.connector, source, mapping))
          .map((values) => ({ values })),
    );
  }
}
