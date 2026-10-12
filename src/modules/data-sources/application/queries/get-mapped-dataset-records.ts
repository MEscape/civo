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
import { createReadWindow } from '../../domain/pagination/read-window';

import type { DatasetWithSource } from '../../domain/models/dataset';
import type { ReadWindow } from '../../domain/pagination/read-window';
import type { MappedRecordsView } from '../contracts/data-source-views';
import type { PublicDatasetDependencies } from '../data-source-dependencies';

/** Which dataset of which website, and which of its records are wanted. */
export interface MappedRecordsRequest {
  readonly datasetId: string;
  readonly websiteId: string;
  readonly window: ReadWindow;
}

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
 * The window (`limit` records from `offset`) is the caller's: the component
 * shows as many records as its editor set, a chart or a map asks for the
 * part the visitor has zoomed to. This use case knows no kinds of content,
 * only the backstop of `createReadWindow`.
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
    request: MappedRecordsRequest,
  ): AppResultAsync<MappedRecordsView, GetMappedDatasetRecordsError> {
    const { datasets, connector, hasher } = this.deps;
    const parsedDatasetId = parseDatasetId(request.datasetId);
    const parsedWebsiteId = parseWebsiteId(request.websiteId);

    if (parsedDatasetId.isErr() || parsedWebsiteId.isErr()) {
      return errAsync(datasetNotFound());
    }
    const window = createReadWindow(request.window);
    if (window.isErr()) {
      return errAsync(window.error);
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

          return connector
            .fetchBody(source, { window: window.value, path: dataset.path })
            .map((body) => {
              const mapped = mapRecords({
                mapping,
                body,
                hash: (text) => hasher.hash(text),
                limit: window.value.limit,
              });
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
