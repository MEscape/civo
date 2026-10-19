import type { AppResultAsync } from '@lib/result';

import { createDatasetMapping } from '../../domain/mapping/dataset-mapping';
import { loadAuthorizedDataset } from '../load-authorized-dataset';
import { DATA_SOURCE_RATE_LIMITS } from '../rate-limits';
import { dryRunMapping } from '../services/dry-run-mapping';
import { withinActorLimit } from '../services/within-actor-limit';

import type {
  MappingPreviewView,
  PreviewDatasetMappingInput,
} from '../contracts/data-source-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';
import type { DryRunError } from '../services/dry-run-mapping';
import type { ActorLimitError } from '../services/within-actor-limit';

/** Applies a candidate mapping to one live record without saving it. Each person has a budget of previews. */
export class PreviewDatasetMapping {
  constructor(private readonly deps: ConnectedDataSourceDependencies) {}

  execute(
    input: PreviewDatasetMappingInput,
  ): AppResultAsync<MappingPreviewView, LoadDatasetError | DryRunError | ActorLimitError> {
    return loadAuthorizedDataset(this.deps, input.datasetId, 'dataset.map')
      .andThen(withinActorLimit(this.deps, DATA_SOURCE_RATE_LIMITS.previewMapping))
      .andThen(({ dataset, source }) =>
        createDatasetMapping(dataset.canonicalKind, input.mapping)
          .asyncAndThen((mapping) =>
            dryRunMapping(this.deps.connector, { source, path: dataset.path }, mapping),
          )
          .map((values) => ({ values })),
      );
  }
}
