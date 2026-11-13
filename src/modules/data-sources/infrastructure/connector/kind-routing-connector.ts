import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { assertNever } from '@lib/utils';

import { connectorUnavailable } from '../../domain/errors/data-source-errors';

import { SnapshotConnector } from './snapshot-connector';

import type { DataSource } from '../../domain/models/data-source';
import type {
  ConnectorError,
  DataSourceConnector,
  FetchOptions,
} from '../../domain/ports/data-source-connector.port';

/**
 * The `DataSourceConnector` the application sees: it picks the adapter for
 * a source's kind. Exhaustive over kinds, so a new kind does not compile
 * until it is decided here. The legacy MOCK storage name now routes to a
 * validated snapshot adapter; it never invents records. An unsupported
 * stored configuration yields connectorUnavailable() in its adapter.
 */
export class KindRoutingConnector implements DataSourceConnector {
  constructor(
    private readonly rest: DataSourceConnector,
    private readonly snapshot: DataSourceConnector = new SnapshotConnector(),
  ) {}

  test(source: DataSource): AppResultAsync<void, ConnectorError> {
    const connector = this.forKind(source);
    return connector === null ? errAsync(connectorUnavailable()) : connector.test(source);
  }

  fetchBody(source: DataSource, options: FetchOptions): AppResultAsync<unknown, ConnectorError> {
    const connector = this.forKind(source);
    return connector === null
      ? errAsync(connectorUnavailable())
      : connector.fetchBody(source, options);
  }

  private forKind(source: DataSource): DataSourceConnector | null {
    switch (source.kind) {
      case 'REST':
        return this.rest;
      case 'MOCK':
        return this.snapshot;
      default:
        return assertNever(source.kind);
    }
  }
}
