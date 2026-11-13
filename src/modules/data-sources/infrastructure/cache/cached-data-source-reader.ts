import 'server-only';

import { logger } from '@lib/logger';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseRestConnectionConfig } from '../../domain/config/rest-connection-config';
import { connectionFailed } from '../../domain/errors/data-source-errors';

import { SourceReadFailure, readCachedRestBody } from './cached-rest-body';

import type { DataSource } from '../../domain/models/data-source';
import type { ReadWindow } from '../../domain/pagination/read-window';
import type {
  ConnectorError,
  DataSourceConnector,
  FetchOptions,
} from '../../domain/ports/data-source-connector.port';

const log = logger.withContext({ module: 'data-source.cache' });

function toConnectorError(thrown: unknown): ConnectorError {
  if (thrown instanceof SourceReadFailure) {
    return thrown.error;
  }
  // Anything else crossed the cache boundary unexpectedly: report it once, as unreachable.
  log.error('Cached source read failed unexpectedly', thrown);
  return connectionFailed(thrown);
}

/**
 * The window as the cache key sees it. An area only changes what the API answers when the source
 * can be asked for one; for any other source it must not be part of the key, or every pan of a map
 * would miss the cache and download the whole list again.
 */
function cacheableWindow(source: DataSource, window: ReadWindow): ReadWindow {
  const { bounds, ...plain } = window;
  const parsed = parseRestConnectionConfig(source.config);
  return bounds !== undefined && parsed.isOk() && parsed.value.spatialFilter !== undefined
    ? window
    : plain;
}

/**
 * Decorates a live connector with the cache described in
 * `cached-rest-body.ts`. Inject THIS where content is served to visitors
 * (`GetMappedDatasetRecords`) and the live connector everywhere that must
 * show current state (test, discover, preview, save mapping).
 *
 * `test` is never cached. Only REST has a body to cache; any other kind is
 * passed to the live connector, which answers `connectorUnavailable()`.
 * The cached REST read goes through the shared `restJsonConnector`, so the
 * live connector wrapped here should route REST to that same instance.
 */
export class CachedDataSourceConnector implements DataSourceConnector {
  constructor(private readonly live: DataSourceConnector) {}

  test(source: DataSource): AppResultAsync<void, ConnectorError> {
    return this.live.test(source);
  }

  fetchBody(source: DataSource, options: FetchOptions): AppResultAsync<unknown, ConnectorError> {
    if (source.kind !== 'REST') {
      return this.live.fetchBody(source, options);
    }
    return fromThrowableAsync(
      () =>
        readCachedRestBody({
          tenantId: source.tenantId,
          dataSourceId: source.id,
          rawConfig: source.config,
          path: options.path ?? null,
          window: cacheableWindow(source, options.window),
        }),
      toConnectorError,
    );
  }
}
