import type { AppError } from '@lib/errors';
import { combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseDataSourceId, parseDatasetId } from '../../domain/models/ids';
import { liveDatasetsOf } from '../services/live-dataset-uses';

import type {
  DataRemoval,
  DataRemovalError,
  DataRemovalGuard,
  DataRemovalGuardError,
} from '../../domain/ports/data-source.port';
import type { DeleteUnusedDataDependencies } from '../release-dependencies';

export interface DeleteUnusedDataInput {
  /** A single dataset, or a source with all of its datasets. */
  readonly kind: 'dataset' | 'source';
  readonly id: string;
}

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
 * editor) nor the live release (the public site, where missing data is an
 * error, never sample data). The data module authorizes the deletion again
 * and asks this guard right before it deletes, so the check cannot be
 * skipped and runs against the stored website of the data, not a request's.
 *
 * @audit-exempt The data module records `dataset.deleted` / `data_source.deleted` for the deletion itself; a refusal changes nothing.
 */
export class DeleteUnusedData {
  constructor(private readonly deps: DeleteUnusedDataDependencies) {}

  execute(input: DeleteUnusedDataInput): AppResultAsync<DataRemoval, DataRemovalError> {
    const { authorization, data } = this.deps;
    return authorization
      .requireInTenant(input.kind === 'dataset' ? 'dataset.delete' : 'datasource.delete')
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
      releases.findPublished(websiteId).map((live) => liveDatasetsOf(live, data)),
    ] as const)
      .mapErr(toGuardError)
      .andThen(([drafts, live]) =>
        datasetIds.some((datasetId) => drafts.has(datasetId) || live.has(datasetId))
          ? errAsync(data.inUse())
          : okAsync(undefined),
      );
  };
}
