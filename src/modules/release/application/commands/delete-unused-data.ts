import type { AppError } from '@lib/errors';
import { combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseDataSourceId, parseDatasetId } from '../../domain/models/ids';
import { RELEASE_RATE_LIMITS } from '../rate-limits';
import { liveDatasetsOf } from '../services/live-dataset-uses';
import { loadAuthorizedDataRemoval } from '../services/load-authorized-data-removal';
import { limitActor } from '../services/within-actor-limit';

import type {
  DataRemoval,
  DataRemovalError,
  DataRemovalGuard,
  DataRemovalGuardError,
} from '../../domain/ports/data-source.port';
import type { DeleteUnusedDataInput } from '../contracts/data-removal-inputs';
import type { DeleteUnusedDataDependencies } from '../release-dependencies';
import type { ActorLimitError } from '../services/within-actor-limit';

export type { DeleteUnusedDataInput } from '../contracts/data-removal-inputs';

/** A guard failure the data module understands; anything else becomes an infrastructure failure. */
function toGuardError(error: AppError): DataRemovalGuardError {
  switch (error.kind) {
    case 'conflict':
    case 'infrastructure':
    case 'unauthorized':
    case 'forbidden':
      return error;
    default:
      return { kind: 'infrastructure', code: error.code, message: error.message, cause: error };
  }
}

/**
 * Deletes data only while no page shows it: neither a saved draft (the
 * editor), nor a saved map layer, nor the live release (the public site,
 * where missing data is an error, never sample data), whose frozen maps
 * count with its pages. The data module authorizes the deletion again
 * and asks this guard right before it deletes, so the check cannot be
 * skipped and runs against the stored website of the data, not a request's.
 *
 * @audit-exempt The data module records `dataset.deleted` / `data_source.deleted` for the deletion itself; a refusal changes nothing.
 */
export class DeleteUnusedData {
  constructor(private readonly deps: DeleteUnusedDataDependencies) {}

  execute(
    input: DeleteUnusedDataInput,
  ): AppResultAsync<DataRemoval, DataRemovalError | ActorLimitError> {
    const { data } = this.deps;
    return loadAuthorizedDataRemoval(this.deps, input)
      .andThen(({ actor }) => limitActor(this.deps, RELEASE_RATE_LIMITS.deleteUnusedData, actor))
      .andThen(() =>
        input.kind === 'dataset'
          ? parseDatasetId(input.id).asyncAndThen((id) => data.deleteDataset(id, this.guard))
          : parseDataSourceId(input.id).asyncAndThen((id) => data.deleteDataSource(id, this.guard)),
      );
  }

  private readonly guard: DataRemovalGuard = ({ websiteId, datasetIds }) => {
    const { data, releases } = this.deps;
    return combineAsync([
      data.datasetsInDrafts(websiteId),
      data.datasetsInMaps(websiteId),
      releases.findPublished(websiteId).map((live) => liveDatasetsOf(live, this.deps)),
    ] as const)
      .mapErr(toGuardError)
      .andThen(([drafts, maps, live]) =>
        datasetIds.some(
          (datasetId) => drafts.has(datasetId) || maps.has(datasetId) || live.has(datasetId),
        )
          ? errAsync(data.inUse())
          : okAsync(undefined),
      );
  };
}
