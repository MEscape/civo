import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { readSnapshotSourceConfig } from '../../domain/config/snapshot-source-config';
import { connectorUnavailable } from '../../domain/errors/data-source-errors';
import { orderedWindowRecords, resolveDataWindow } from '../../domain/pagination/data-window';

import type { DataSource } from '../../domain/models/data-source';
import type {
  ConnectorError,
  DataSourceConnector,
  FetchOptions,
} from '../../domain/ports/data-source-connector.port';

/** Reads bounded, immutable JSON snapshots without file access or outbound requests. */
export class SnapshotConnector implements DataSourceConnector {
  test(source: DataSource): AppResultAsync<void, ConnectorError> {
    return readSnapshotSourceConfig(source.config) === null
      ? errAsync(connectorUnavailable())
      : okAsync(undefined);
  }

  fetchBody(source: DataSource, options: FetchOptions): AppResultAsync<unknown, ConnectorError> {
    const config = readSnapshotSourceConfig(source.config);
    if (
      config === null ||
      (options.path !== undefined && options.path !== null && options.path !== '')
    ) {
      return errAsync(connectorUnavailable());
    }
    const window = resolveDataWindow(options.window, config.windowPolicy);
    if (window.isErr()) {
      return errAsync(window.error);
    }
    const { offset, limit } = window.value;
    // The extra record preserves the existing mapping pipeline's truncation signal.
    return okAsync(
      orderedWindowRecords(config.records, config.windowPolicy)
        .slice(offset, offset + limit + 1)
        .map((record) => ({
          ...record,
          _provenance: config.provenance,
        })),
    );
  }
}
