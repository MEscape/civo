import type { AppResultAsync } from '@lib/result';

import { createDatasetMapping, ensureRequiredTargets } from '../../domain/mapping/dataset-mapping';
import { toDatasetView } from '../data-source-view-mappers';
import { loadAuthorizedDataset } from '../load-authorized-dataset';
import { DATA_SOURCE_RATE_LIMITS } from '../rate-limits';
import { dryRunMapping } from '../services/dry-run-mapping';
import { withinActorLimit } from '../services/within-actor-limit';

import type { DatasetView, SaveDatasetMappingInput } from '../contracts/data-source-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';
import type { DryRunError } from '../services/dry-run-mapping';
import type { ActorLimitError } from '../services/within-actor-limit';

export type SaveDatasetMappingError = LoadDatasetError | DryRunError | ActorLimitError;

/**
 * Validates and saves a field mapping. Three gates, in order:
 *
 *  1. every domain invariant (safe paths, no conflicting targets,
 *     targets drawn from the canonical kind);
 *  2. every REQUIRED canonical field is covered (enforced here, not just
 *     in the UI);
 *  3. a dry run against a live record succeeds.
 *
 * The dry run calls the external system, so each person has a budget of saves.
 */
export class SaveDatasetMapping {
  constructor(private readonly deps: ConnectedDataSourceDependencies) {}

  execute(input: SaveDatasetMappingInput): AppResultAsync<DatasetView, SaveDatasetMappingError> {
    const { connector, datasets, audit } = this.deps;

    return loadAuthorizedDataset(this.deps, input.datasetId, 'dataset.map')
      .andThen(withinActorLimit(this.deps, DATA_SOURCE_RATE_LIMITS.saveMapping))
      .andThen(({ actor, dataset, source }) =>
        createDatasetMapping(dataset.canonicalKind, input.mapping)
          .andThen((mapping) => ensureRequiredTargets(dataset.canonicalKind, mapping))
          .asyncAndThen((mapping) =>
            dryRunMapping(connector, { source, path: dataset.path }, mapping).map(() => mapping),
          )
          .andThen((mapping) => datasets.saveMapping(dataset.id, actor.tenantId, mapping))
          .map((saved) => {
            audit.record({
              type: 'dataset.mapping_saved',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: saved.websiteId,
              datasetId: saved.id,
            });
            return toDatasetView(saved);
          }),
      );
  }
}
