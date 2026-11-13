import { APP_IDENTITY } from '@lib/config';
import { logger } from '@lib/logger';
import { err, fromThrowable, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { parseJson } from '@lib/utils/json';

import {
  authenticationFailed,
  connectionFailed,
  connectionTimedOut,
  responseNotJson,
  responseTooLarge,
  responseUnreadable,
  upstreamError,
  upstreamRedirected,
} from '../../domain/errors/data-source-errors';

import type { RestConnectionConfig } from '../../domain/config/rest-connection-config';
import type { DataSourceId } from '../../domain/models/ids';
import type { OutgoingRequest } from '../../domain/pagination/build-request';
import type { ConnectorError } from '../../domain/ports/data-source-connector.port';

/** Request timeout. It stays armed until the body is read, not just until headers arrive. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Number of bytes in one kibibyte. */
const BYTES_PER_KIBIBYTE = 1024;

/** Number of kibibytes in one mebibyte. */
const KIBIBYTES_PER_MEBIBYTE = 1024;

/** Largest response body accepted from an external source, in mebibytes. */
const MAX_RESPONSE_MEBIBYTES = 5;

/** Largest response body accepted from an external source, in bytes. */
const MAX_RESPONSE_BYTES = MAX_RESPONSE_MEBIBYTES * KIBIBYTES_PER_MEBIBYTE * BYTES_PER_KIBIBYTE;

/** Open-data portals and their firewalls often refuse a client that does not say who it is. */
const USER_AGENT = `${APP_IDENTITY.name}-DataSource/1.0`;

/** The redirect class of HTTP status codes: from 300 up to, not including, 400. */
const HTTP_STATUS_REDIRECT_MIN = 300;
const HTTP_STATUS_REDIRECT_END = 400;

/** HTTP status codes indicating that upstream authentication failed. */
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

const log = logger.withContext({ module: 'data-source.rest-connector' });

/** One HTTP request to a source: what to send, and whose it is (for the log). */
export interface Exchange {
  readonly outgoing: OutgoingRequest;
  readonly config: Pick<RestConnectionConfig, 'method'>;
  readonly authHeaders: Readonly<Record<string, string>>;
  readonly dataSourceId: DataSourceId;
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

/** The failure an answer's status stands for, or `null` for a success; the body of a failure is never read. */
async function rejectStatus(
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

/** Sends one request with `send` and returns its parsed JSON body, or the failure it stands for. */
export async function exchangeJson(
  exchange: Exchange,
  send: typeof fetch,
): Promise<AppResult<unknown, ConnectorError>> {
  const { outgoing, config, authHeaders, dataSourceId } = exchange;
  const { url, body: requestBody } = outgoing;

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

  const rejection = await rejectStatus(response, url, dataSourceId);

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
