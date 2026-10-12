import type { AppResultAsync } from '@lib/result';

import { DISCOVERY_LIMITS, discoverFromBody } from '../../domain/discovery/discovery';
import { firstRecords } from '../../domain/pagination/read-window';
import { loadAuthorizedDataset } from '../load-authorized-dataset';

import type { ConnectorError } from '../../domain/ports/data-source-connector.port';
import type { DiscoveryView } from '../contracts/data-source-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { LoadDatasetError } from '../load-authorized-dataset';

/**
 * Lists the fields available in a dataset's source, from a live sample.
 * Only field names and short previews are returned; the raw sample records
 * stay on the server.
 */
export class DiscoverDataset {
  constructor(private readonly deps: ConnectedDataSourceDependencies) {}

  execute(id: string): AppResultAsync<DiscoveryView, LoadDatasetError | ConnectorError> {
    return loadAuthorizedDataset(this.deps, id, 'dataset.map').andThen(({ dataset, source }) =>
      this.deps.connector
        .fetchBody(source, {
          window: firstRecords(DISCOVERY_LIMITS.sampleSize),
          path: dataset.path,
        })
        .map((body) => ({
          fields: discoverFromBody(body).fields,
        })),
    );
  }
}
