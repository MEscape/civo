import 'server-only';
import { lookup } from 'node:dns/promises';

import type { TenantId } from '@modules/auth';

import { APP_IDENTITY } from '@lib/config';
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
  recordsNotFound,
  responseNotJson,
  responseTooLarge,
  responseUnreadable,
  upstreamError,
  upstreamRedirected,
} from '../../domain/errors/data-source-errors';
import { buildRequest } from '../../domain/pagination/build-request';
import {
  PAGINATION_LIMITS,
  firstPageRequest,
  nextPageRequest,
  visitedKeyOf,
} from '../../domain/pagination/pagination-strategy';
import { firstRecords } from '../../domain/pagination/read-window';
import { locateRecords } from '../../domain/pagination/records-locator';
import { isPublicAddress } from '../../domain/rules/outbound-url';
import { EnvironmentCredentialProvider } from '../env/environment-credential-provider';

import type { RestConnectionConfig } from '../../domain/config/rest-connection-config';
import type { DataSource } from '../../domain/models/data-source';
import type { AuthMode } from '../../domain/models/data-source-kinds';
import type { DataSourceId } from '../../domain/models/ids';
import type { OutgoingRequest } from '../../domain/pagination/build-request';
import type { PageRequest, PaginationStrategy } from '../../domain/pagination/pagination-strategy';
import type { ReadWindow } from '../../domain/pagination/read-window';
import type {
  CredentialProvider,
  ResolvedCredential,
} from '../../domain/ports/credential-provider.port';
import type {
  ConnectorError,
  DataSourceConnector,
  FetchOptions,
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

/**
 * Time one read may spend fetching pages. Each request has its own timeout;
 * this stops a slow API from holding a visitor's render for pages x timeout.
 * Pages already read are returned.
 */
export const TOTAL_READ_BUDGET_MS = 30_000;

/** Open-data portals and their firewalls often refuse a client that does not say who it is. */
const USER_AGENT = `${APP_IDENTITY.name}-DataSource/1.0`;

/** The redirect class of HTTP status codes: from 300 up to, not including, 400. */
const HTTP_STATUS_REDIRECT_MIN = 300;
const HTTP_STATUS_REDIRECT_END = 400;

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

/** Whether a paginated read has what it needs or has used what it may: the window is full, the pages or the time are spent. */
function isReadComplete(state: {
  readonly filled: boolean;
  readonly pages: number;
  readonly deadline: number;
}): boolean {
  return state.filled || state.pages >= PAGINATION_LIMITS.maxPages || Date.now() >= state.deadline;
}

/** Notes a cursor or link as requested, so an API that keeps answering with it cannot hold the read in a loop. */
function rememberVisited(note: {
  readonly visited: Set<string>;
  readonly pagination: PaginationStrategy;
  readonly request: PageRequest;
}): void {
  const key = visitedKeyOf(note.pagination, note.request);
  if (key !== null) {
    note.visited.add(key);
  }
}

/** One read of a source: which source, and which records of it. */
export interface RestRead {
  readonly target: RestTarget;
  readonly window: ReadWindow;
  readonly path?: string | null | undefined;
}

interface PageRead {
  readonly config: RestConnectionConfig;
  readonly endpoint: URL;
  readonly authHeaders: Readonly<Record<string, string>>;
  readonly dataSourceId: DataSourceId;
  readonly window: ReadWindow;
}

interface Exchange {
  readonly outgoing: OutgoingRequest;
  readonly config: Pick<RestConnectionConfig, 'method'>;
  readonly authHeaders: Readonly<Record<string, string>>;
  readonly dataSourceId: DataSourceId;
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
 *  - one timeout covers headers and body, redirects are reported, never followed, and
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
    return this.fetchRestBody({ target: toRestTarget(source), window: firstRecords(1) }).map(
      () => undefined,
    );
  }

  fetchBody(source: DataSource, options: FetchOptions): AppResultAsync<unknown, ConnectorError> {
    return this.fetchRestBody({
      target: toRestTarget(source),
      window: options.window,
      path: options.path,
    });
  }

  /**
   * The request itself, from plain data. Also the entry point of the cached
   * read path. A source with pagination is read page by page until the
   * window is filled; the answer holds the window's records, plus one more
   * when the source has more, so the caller can tell it was cut short.
   */
  fetchRestBody(read: RestRead): AppResultAsync<unknown, ConnectorError> {
    return parseRestConnectionConfig(read.target.rawConfig).asyncAndThen((config) => {
      const effectiveConfig =
        read.path !== undefined && read.path !== null ? { ...config, path: read.path } : config;
      return this.request(effectiveConfig, read);
    });
  }

  private request(
    config: RestConnectionConfig,
    read: RestRead,
  ): AppResultAsync<unknown, ConnectorError> {
    const decision = resolveRestEndpoint(config);

    if (!decision.isAllowed) {
      return errAsync(addressNotAllowed());
    }

    const { url } = decision;
    const { target, window } = read;

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
      .andThen(
        (credential) =>
          new ResultAsync(
            this.readPages({
              config,
              endpoint: url,
              authHeaders: toAuthHeaders(credential),
              dataSourceId: target.dataSourceId,
              window,
            }),
          ),
      );
  }

  /**
   * Reads the endpoint, and for a paginated source the pages after it, until
   * the window (`window.limit` records from `window.offset`, plus one to
   * show there is more) is filled. A plain endpoint answers its list cut to
   * the window, or its body untouched when that is no list.
   */
  private readPages(read: PageRead): Promise<AppResult<unknown, ConnectorError>> {
    return read.config.pagination.kind === 'none' ? this.readPlain(read) : this.readPaginated(read);
  }

  private async readPlain(read: PageRead): Promise<AppResult<unknown, ConnectorError>> {
    const { config, endpoint, authHeaders, dataSourceId, window } = read;
    const outgoing = buildRequest(endpoint, config.requestBody, null);
    if (outgoing === null) {
      return err(addressNotAllowed());
    }
    const answer = await this.exchangeAsync({ outgoing, config, authHeaders, dataSourceId });
    return answer.andThen((body) => this.plainAnswer(body, config, window));
  }

  /**
   * Bounded three ways: the window, the pages (`PAGINATION_LIMITS.maxPages`)
   * and the time (`TOTAL_READ_BUDGET_MS`). A failing page fails the whole
   * read: half a window is never cached.
   */
  private async readPaginated(read: PageRead): Promise<AppResult<unknown, ConnectorError>> {
    const { config, endpoint, authHeaders, dataSourceId, window } = read;
    const { pagination } = config;
    const deadline = Date.now() + TOTAL_READ_BUDGET_MS;
    const start = firstPageRequest(pagination, window.offset);
    const wanted = start.skip + window.limit + 1;
    const visited = new Set<string>();
    const records: unknown[] = [];
    const windowOf = () => records.slice(start.skip, wanted);
    let page = start.request;
    let pages = 0;

    for (;;) {
      const outgoing = buildRequest(endpoint, config.requestBody, page);
      if (outgoing === null) {
        log.warn('Refused a next page outside the configured origin', {
          dataSourceId,
          host: endpoint.host,
        });
        return err(addressNotAllowed());
      }

      const answer = await this.exchangeAsync({ outgoing, config, authHeaders, dataSourceId });
      if (answer.isErr()) {
        return err(answer.error);
      }
      pages += 1;

      const located = locateRecords(answer.value, config.recordsPath);
      if (located === null) {
        return pages === 1 ? err(recordsNotFound()) : ok(windowOf());
      }
      records.push(...located);

      const next = isReadComplete({ filled: records.length >= wanted, pages, deadline })
        ? null
        : nextPageRequest(pagination, {
            pages,
            pageRecords: located.length,
            totalRecords: records.length,
            startOffset: window.offset,
            body: answer.value,
            visited,
          });
      if (next === null) {
        return ok(windowOf());
      }
      rememberVisited({ visited, pagination, request: next });
      page = next;
    }
  }

  /** An explicit records path is applied here, and a located list is cut to the window; otherwise the body goes on untouched. */
  private plainAnswer(
    body: unknown,
    config: RestConnectionConfig,
    window: ReadWindow,
  ): AppResult<unknown, ConnectorError> {
    const located = locateRecords(body, config.recordsPath);
    if (located === null) {
      return config.recordsPath === null ? ok(body) : err(recordsNotFound());
    }
    return ok(located.slice(window.offset, window.offset + window.limit + 1));
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

  /** The failure an answer's status stands for, or `null` for a success; the body of a failure is never read. */
  private async rejectStatus(
    response: Response,
    url: URL,
    dataSourceId: DataSourceId,
  ): Promise<ConnectorError | null> {
    const { status } = response;

    if (status >= HTTP_STATUS_REDIRECT_MIN && status < HTTP_STATUS_REDIRECT_END) {
      await discardBody(response);

      log.warn('Data source answered with a redirect', { dataSourceId, host: url.host, status });

      return upstreamRedirected();
    }

    if (status === HTTP_STATUS_UNAUTHORIZED || status === HTTP_STATUS_FORBIDDEN) {
      await discardBody(response);
      return authenticationFailed();
    }

    if (!response.ok) {
      await discardBody(response);

      log.warn('Data source answered with an error status', {
        dataSourceId,
        host: url.host,
        status,
      });

      return upstreamError();
    }

    return null;
  }

  private async exchangeAsync(exchange: Exchange): Promise<AppResult<unknown, ConnectorError>> {
    const { outgoing, config, authHeaders, dataSourceId } = exchange;
    const { url, body: requestBody } = outgoing;
    const send = this.fetchImplementation ?? fetch;

    // `AbortSignal.timeout` (unlike `withTimeout`) actually cancels the request.
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await send(url, {
        method: config.method,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...(requestBody === null ? {} : { 'Content-Type': 'application/json' }),
          ...authHeaders,
        },
        ...(requestBody === null ? {} : { body: JSON.stringify(requestBody) }),
        signal,
        // A redirect target was never vetted against the SSRF policy, so it is reported, not followed.
        redirect: 'manual',
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

    const rejection = await this.rejectStatus(response, url, dataSourceId);

    if (rejection !== null) {
      return err(rejection);
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
