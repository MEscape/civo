import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { assertNever } from '@lib/utils';

import { connectorUnavailable } from '../../domain/errors/data-source-errors';

import type { DataSource } from '../../domain/models/data-source';
import type {
  ConnectorError,
  DataSourceConnector,
} from '../../domain/ports/data-source-connector.port';

/**
 * The `DataSourceConnector` the application sees: it picks the adapter for
 * a source's kind. Exhaustive over kinds, so a new kind does not compile
 * until it is decided here. A kind without a connector (MOCK is served by
 * mock providers directly; there is nothing to connect to) yields
 * `connectorUnavailable()`, as the port promises.
 */
export class KindRoutingConnector implements DataSourceConnector {
  constructor(private readonly rest: DataSourceConnector) {}

  test(source: DataSource): AppResultAsync<void, ConnectorError> {
    const connector = this.forKind(source);
    return connector === null ? errAsync(connectorUnavailable()) : connector.test(source);
  }

  fetchBody(source: DataSource): AppResultAsync<unknown, ConnectorError> {
    const connector = this.forKind(source);
    return connector === null ? errAsync(connectorUnavailable()) : connector.fetchBody(source);
  }

  private forKind(source: DataSource): DataSourceConnector | null {
    switch (source.kind) {
      case 'REST':
        return this.rest;
      case 'MOCK':
        return null;
      default:
        return assertNever(source.kind);
    }
  }
}
