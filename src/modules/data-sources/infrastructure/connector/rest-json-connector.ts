import 'server-only';
import { lookup } from 'node:dns/promises';

import type { TenantId } from '@modules/auth';

import { logger } from '@lib/logger';
import {
  err,
  errAsync,
  fromThrowable,
  fromThrowableAsync,
  ok,
  okAsync,
  ResultAsync,
} from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { parseJson } from '@lib/utils/json';

import {
  parseRestConnectionConfig,
  resolveRestEndpoint,
} from '../../domain/config/rest-connection-config';
import {
  addressNotAllowed,
  authenticationFailed,
  connectionFailed,
  connectionTimedOut,
  responseNotJson,
  responseTooLarge,
  responseUnreadable,
  upstreamError,
} from '../../domain/errors/data-source-errors';
import { isPublicAddress } from '../../domain/rules/outbound-url';
import { EnvironmentCredentialProvider } from '../env/environment-credential-provider';

import type { RestConnectionConfig } from '../../domain/config/rest-connection-config';
import type { DataSource } from '../../domain/models/data-source';
import type { AuthMode } from '../../domain/models/data-source-kinds';
import type { DataSourceId } from '../../domain/models/ids';
import type {
  CredentialProvider,
  ResolvedCredential,
} from '../../domain/ports/credential-provider.port';
import type {
  ConnectorError,
  DataSourceConnector,
} from '../../domain/ports/data-source-connector.port';

/** Request timeout. It stays armed until the body is read, not just until headers arrive. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Number of bytes in one kibibyte. */
const BYTES_PER_KIBIBYTE = 1024;

/** Number of kibibytes in one mebibyte. */
const KIBIBYTES_PER_MEBIBYTE = 1024;

/** Largest response body accepted from an external source, in mebibytes. */
const MAX_RESPONSE_MEBIBYTES = 5;

/** Largest response body accepted from an external source, in bytes. */
export const MAX_RESPONSE_BYTES =
  MAX_RESPONSE_MEBIBYTES * KIBIBYTES_PER_MEBIBYTE * BYTES_PER_KIBIBYTE;

/** HTTP status codes indicating that upstream authentication failed. */
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

const log = logger.withContext({ module: 'data-source.rest-connector' });

/** Resolves a hostname to every address it currently maps to. */
export type HostResolver = (hostname: string) => Promise<string[]>;

const resolveWithDns: HostResolver = async (hostname) => {
  const records = await lookup(hostname, {
    all: true,
    order: 'verbatim',
  });

  return records.map((record) => record.address);
};

/**
 * What a REST request needs from a source, as plain data. The cached read
 * path (`caching/`) calls the connector with this instead of a whole
 * `DataSource`, so volatile fields such as `status` never reach a cache key.
 */
export interface RestTarget {
  readonly tenantId: TenantId;
  readonly dataSourceId: DataSourceId;
  readonly rawConfig: unknown;
}

export interface RestJsonConnectorDependencies {
  readonly credentials: CredentialProvider;
  readonly resolveHost?: HostResolver;
  /** Defaults to the global `fetch`. A seam for tests and for socket-level address pinning. */
  readonly fetchImplementation?: typeof fetch;
}

/** Exhaustive over the modes that carry a secret: a new mode does not compile until it is decided here. */
const AUTH_HEADERS: Readonly<
  Record<Exclude<AuthMode, 'NONE'>, (secret: string) => Readonly<Record<string, string>>>
> = {
  API_KEY: (secret) => ({ 'X-API-Key': secret }),
  BEARER_TOKEN: (secret) => ({ Authorization: `Bearer ${secret}` }),
};

function toAuthHeaders(credential: ResolvedCredential): Readonly<Record<string, string>> {
  return credential.mode === 'NONE' ? {} : AUTH_HEADERS[credential.mode](credential.secret);
}

function toRestTarget(source: DataSource): RestTarget {
  return {
    tenantId: source.tenantId,
    dataSourceId: source.id,
    rawConfig: source.config,
  };
}

function isIpLiteral(hostname: string): boolean {
  return hostname.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/** Releases a body we are not going to read, so the connection is not held open. */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Nothing useful to do if cancelling an already-failed stream fails.
  }
}

/**
 * Reads a body as text, stopping as soon as it exceeds `maxBytes` instead
 * of buffering an unbounded stream. Exceeding the limit is an expected
 * outcome, not an exception.
 */
async function readBounded(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<AppResult<string, ConnectorError>> {
  try {
    if (!response.body) {
      return ok(await response.text());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        return err(responseTooLarge());
      }

      chunks.push(value);
    }

    return ok(Buffer.concat(chunks).toString('utf-8'));
  } catch (cause) {
    return err(signal.aborted ? connectionTimedOut() : responseUnreadable(cause));
  }
}

/**
 * Talks to a municipal or civic REST API that returns JSON. Both the target
 * URL and the response are untrusted, so every request is defensive:
 *
 *  - the stored config is re-parsed, and the endpoint re-checked against the
 *    SSRF policy, on EVERY request: configuration saved before a rule
 *    existed gets no permanent pass;
 *  - the hostname is resolved and EVERY returned address must be public, so
 *    a public-looking name that points at a private address is refused;
 *  - one timeout covers headers and body, redirects are not followed, and
 *    the body has a hard size ceiling;
 *  - the body is parsed as JSON and never treated as HTML or code.
 *
 * Known residual gap: the address check and `fetch` each do their own DNS
 * lookup, so a resolver answering differently between the two could slip
 * through. Closing it fully needs address pinning at socket level (an undici
 * `Agent` with a custom `lookup`, supplied via `fetchImplementation`).
 * Pair this connector with an egress allowlist at the network layer.
 *
 * Failures are translated to our own errors and logged ONCE, here. Only the
 * host is logged, never the full URL, whose query string may hold a token.
 * Only REST sources reach this class: `KindRoutingConnector` decides that.
 */
export class RestJsonConnector implements DataSourceConnector {
  private readonly credentials: CredentialProvider;
  private readonly resolveHost: HostResolver;
  private readonly fetchImplementation: typeof fetch | undefined;

  constructor(dependencies: RestJsonConnectorDependencies) {
    this.credentials = dependencies.credentials;
    this.resolveHost = dependencies.resolveHost ?? resolveWithDns;
    this.fetchImplementation = dependencies.fetchImplementation;
  }

  test(source: DataSource): AppResultAsync<void, ConnectorError> {
    return this.fetchRestBody(toRestTarget(source)).map(() => undefined);
  }

  fetchBody(source: DataSource): AppResultAsync<unknown, ConnectorError> {
    return this.fetchRestBody(toRestTarget(source));
  }

  /** The request itself, from plain data. Also the entry point of the cached read path. */
  fetchRestBody(target: RestTarget): AppResultAsync<unknown, ConnectorError> {
    return parseRestConnectionConfig(target.rawConfig).asyncAndThen((config) =>
      this.request(config, target),
    );
  }

  private request(
    config: RestConnectionConfig,
    target: RestTarget,
  ): AppResultAsync<unknown, ConnectorError> {
    const decision = resolveRestEndpoint(config);

    if (!decision.isAllowed) {
      return errAsync(addressNotAllowed());
    }

    const { url } = decision;

    // The secret is resolved only after the address is accepted, and lives
    // in memory for this one request.
    return this.checkResolvedAddresses(url, target.dataSourceId)
      .andThen(() =>
        this.credentials.resolve({
          tenantId: target.tenantId,
          dataSourceId: target.dataSourceId,
          authMode: config.authMode,
        }),
      )
      .andThen((credential) => this.exchange(url, toAuthHeaders(credential), target.dataSourceId));
  }

  /**
   * DNS-rebinding guard: a hostname that passed the URL check may still
   * resolve to a private address. A MIX of public and private records is a
   * known evasion, so every address must be public.
   */
  private checkResolvedAddresses(
    url: URL,
    dataSourceId: DataSourceId,
  ): AppResultAsync<void, ConnectorError> {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');

    // Literal IPs were already policy-checked by `resolveRestEndpoint`.
    if (isIpLiteral(hostname)) {
      return okAsync(undefined);
    }

    return fromThrowableAsync(
      () => this.resolveHost(hostname),
      (cause) => {
        log.warn('Could not resolve the data source host', {
          dataSourceId,
          host: url.host,
        });

        return connectionFailed(cause);
      },
    ).andThen((addresses): AppResult<void, ConnectorError> => {
      if (addresses.length === 0) {
        return err(connectionFailed());
      }

      if (!addresses.every(isPublicAddress)) {
        log.warn('Refused a host that resolves to a non-public address', {
          dataSourceId,
          host: url.host,
        });

        return err(addressNotAllowed());
      }

      return ok(undefined);
    });
  }

  private exchange(
    url: URL,
    authHeaders: Readonly<Record<string, string>>,
    dataSourceId: DataSourceId,
  ): AppResultAsync<unknown, ConnectorError> {
    return new ResultAsync(this.exchangeAsync(url, authHeaders, dataSourceId));
  }

  private async exchangeAsync(
    url: URL,
    authHeaders: Readonly<Record<string, string>>,
    dataSourceId: DataSourceId,
  ): Promise<AppResult<unknown, ConnectorError>> {
    const send = this.fetchImplementation ?? fetch;

    // `AbortSignal.timeout` (unlike `withTimeout`) actually cancels the request.
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await send(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...authHeaders },
        signal,
        redirect: 'error',
      });
    } catch (cause) {
      if (signal.aborted) {
        log.warn('Data source request timed out', {
          dataSourceId,
          host: url.host,
        });

        return err(connectionTimedOut());
      }

      log.warn('Data source could not be reached', {
        dataSourceId,
        host: url.host,
      });

      return err(connectionFailed(cause));
    }

    if (response.status === HTTP_STATUS_UNAUTHORIZED || response.status === HTTP_STATUS_FORBIDDEN) {
      await discardBody(response);
      return err(authenticationFailed());
    }

    if (!response.ok) {
      await discardBody(response);

      log.warn('Data source answered with an error status', {
        dataSourceId,
        host: url.host,
        status: response.status,
      });

      return err(upstreamError());
    }

    const declaredLength = Number(response.headers.get('content-length'));

    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      await discardBody(response);
      return err(responseTooLarge());
    }

    const text = await readBounded(response, MAX_RESPONSE_BYTES, signal);

    if (text.isErr()) {
      return err(text.error);
    }

    const body = fromThrowable(
      () => parseJson(text.value),
      (cause) => responseNotJson(cause),
    );

    if (body.isErr()) {
      return err(body.error);
    }

    return ok(body.value);
  }
}

/**
 * One shared instance: the cached read path (`'use cache'`) cannot close
 * over an instance, so it needs a module-level reference to a connector.
 */
export const restJsonConnector = new RestJsonConnector({
  credentials: new EnvironmentCredentialProvider(),
});
