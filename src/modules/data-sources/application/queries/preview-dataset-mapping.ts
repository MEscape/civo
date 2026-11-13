import type { AppResultAsync } from '@lib/result';

import { createDatasetMapping } from '../../domain/mapping/dataset-mapping';
import { DATA_SOURCE_RATE_LIMITS } from '../rate-limits';
import { dryRunMapping } from '../services/dry-run-mapping';
import { loadAuthorizedDataset } from '../services/load-authorized-dataset';
import { withinActorLimit } from '../services/within-actor-limit';

import type { PreviewDatasetMappingInput } from '../contracts/data-source-inputs';
import type { MappingPreviewView } from '../contracts/dataset-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { DryRunError } from '../services/dry-run-mapping';
import type { LoadDatasetError } from '../services/load-authorized-dataset';
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
