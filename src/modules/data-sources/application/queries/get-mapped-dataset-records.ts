import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { datasetNotFound, datasetNotMapped } from '../../domain/errors/data-source-errors';
import { mapRecords } from '../../domain/mapping/mapped-record';
import { parseWebsiteId, parseDatasetId } from '../../domain/models/ids';

import type { DatasetWithSource } from '../../domain/models/dataset';
import type { MappedRecordsView } from '../contracts/data-source-views';
import type { PublicDatasetDependencies } from '../data-source-dependencies';

export type GetMappedDatasetRecordsError =
  NotFoundAppError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * Serves a dataset's records to content components (news grid, events grid,
 * and so on) while a website renders.
 *
 * Intentionally NOT actor-authorized: it runs for visitors of the public
 * site, and the data is what that site shows anyway. What replaces the
 * actor check is the WEBSITE SCOPE: the dataset must belong to the website
 * being rendered. A dataset id sits in editor-controlled page JSON, so
 * without that scope a page of one website could name another website's
 * dataset and read its data. Malformed ids are "not found", like unknown
 * ones, so a visitor learns nothing about which ids exist.
 *
 * Mapping is applied after the fetch and is never cached, so a mapping
 * change takes effect immediately. Caching of the raw response, if any,
 * belongs to the injected connector.
 *
 * @authorization public Feeds published pages, which anyone may read; the dataset is always resolved within the website that renders it.
 */
export class GetMappedDatasetRecords {
  constructor(private readonly deps: PublicDatasetDependencies) {}

  execute(
    datasetId: string,
    websiteId: string,
  ): AppResultAsync<MappedRecordsView, GetMappedDatasetRecordsError> {
    const { datasets, connector, hasher } = this.deps;
    const parsedDatasetId = parseDatasetId(datasetId);
    const parsedWebsiteId = parseWebsiteId(websiteId);

    if (parsedDatasetId.isErr() || parsedWebsiteId.isErr()) {
      return errAsync(datasetNotFound());
    }

    return datasets
      .findWithSourceInWebsite(parsedDatasetId.value, parsedWebsiteId.value)
      .andThen((found): AppResultAsync<DatasetWithSource, NotFoundAppError> =>
        found === null ? errAsync(datasetNotFound()) : okAsync(found),
      )
      .andThen(
        ({
          dataset,
          source,
        }): AppResultAsync<
          MappedRecordsView,
          ConflictAppError | ValidationAppError | InfrastructureAppError
        > => {
          const { mapping } = dataset;
          if (mapping === null) {
            return errAsync(datasetNotMapped());
          }

          return connector.fetchBody(source).map((body) => {
            const mapped = mapRecords(mapping, body, (text) => hasher.hash(text));
            return {
              datasetId: dataset.id,
              canonicalKind: dataset.canonicalKind,
              records: mapped.records,
              skipped: mapped.skipped,
              truncated: mapped.truncated,
            };
          });
        },
      );
  }
}
