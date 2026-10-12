import { fieldPath } from '@lib/errors';
import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import {
  hasUnsafePathSegment,
  isJsonRecord,
  isPlainObject,
  stringifyJson,
  stripTrailingSlash,
} from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import {
  DATA_SOURCE_VALIDATION_CODES,
  createDataSourceErrorBag,
} from '../errors/data-source-errors';
import { isAuthMode } from '../models/data-source-kinds';
import { PAGINATION_LIMITS, checkPaginationStrategy } from '../pagination/pagination-strategy';
import { checkOutboundUrl } from '../rules/outbound-url';

import type { AuthMode } from '../models/data-source-kinds';
import type { PaginationStrategy, RequestMethod } from '../pagination/pagination-strategy';
import type { OutboundRejection, OutboundUrlDecision } from '../rules/outbound-url';

const CODES = DATA_SOURCE_VALIDATION_CODES;

export interface RestConnectionConfig {
  readonly baseUrl: string;
  /** Appended to `baseUrl` for discovery and fetching. */
  readonly path: string;
  readonly authMode: AuthMode;
  /** `POST` for the APIs that take their query as a JSON body. */
  readonly method: RequestMethod;
  /** The JSON body sent with every request of a `POST` source; `null` sends none. */
  readonly requestBody: Readonly<Record<string, JsonValue>> | null;
  /**
   * Dot path of the record list inside the response (`data.items`). `null`
   * lets the well-known envelopes be recognised; set it where they are not.
   */
  readonly recordsPath: string | null;
  readonly pagination: PaginationStrategy;
}

export const DEFAULT_REST_PATH = '/';
export const REQUEST_METHODS: readonly RequestMethod[] = ['GET', 'POST'];

const MAX_REQUEST_BODY_CHARS = 4_000;
const MAX_REQUEST_BODY_DEPTH = 6;

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'baseUrl',
  'path',
  'authMode',
  'method',
  'requestBody',
  'recordsPath',
  'pagination',
]);

const REJECTION_CODES = {
  invalid_url: CODES.baseUrlInvalid,
  scheme_not_allowed: CODES.urlSchemeNotAllowed,
  credentials_not_allowed: CODES.urlCredentialsNotAllowed,
  address_not_allowed: CODES.urlAddressNotAllowed,
} as const satisfies Record<OutboundRejection, string>;

/** A stand-in origin to split `path` into pathname and query; it never reaches a request. */
const PATH_PLACEHOLDER_ORIGIN = 'https://path.invalid';

/**
 * Appends `path` (and its query) to `baseUrl`, keeping everything `baseUrl`
 * already says. Resolving `path` against it as a URL would let a leading
 * slash replace the base path, so `/` (the default) would drop the endpoint an
 * administrator typed and ask the site's root instead. Null when `path` names
 * a host of its own, which would silently ignore `baseUrl`.
 */
function appendPath(baseUrl: string, path: string): URL | null {
  const target = new URL(baseUrl);
  const suffix = new URL(path, PATH_PLACEHOLDER_ORIGIN);
  if (suffix.origin !== PATH_PLACEHOLDER_ORIGIN) {
    return null;
  }

  const suffixPath = suffix.pathname === '/' ? '' : suffix.pathname;
  target.pathname = `${stripTrailingSlash(target.pathname)}${suffixPath}`;
  for (const [key, value] of suffix.searchParams) {
    target.searchParams.append(key, value);
  }
  return target;
}

/**
 * Combines `baseUrl` and `path` and applies the SSRF policy to the RESULT.
 *
 * This is the only place the two are combined, so validating `baseUrl` alone
 * is never the only check: a private target smuggled in through `path` is
 * rejected here as well.
 */
export function resolveRestEndpoint(
  config: Pick<RestConnectionConfig, 'baseUrl' | 'path'>,
): OutboundUrlDecision {
  let target: URL | null;
  try {
    target = appendPath(config.baseUrl, config.path);
  } catch {
    return { isAllowed: false, reason: 'invalid_url' };
  }
  return target === null
    ? { isAllowed: false, reason: 'address_not_allowed' }
    : checkOutboundUrl(target.toString());
}

/**
 * Validates and normalizes the REST base URL, adding any field error to `bag`.
 */
function readBaseUrl(raw: Record<string, unknown>, bag: FieldErrorBag): string {
  const baseUrl = typeof raw['baseUrl'] === 'string' ? raw['baseUrl'].trim() : '';

  if (baseUrl === '') {
    bag.add(fieldPath('config', 'baseUrl'), CODES.baseUrlInvalid);
  }

  return baseUrl;
}

/**
 * Validates and normalizes the REST path, applying the default when omitted.
 */
function readPath(raw: Record<string, unknown>, bag: FieldErrorBag): string {
  const rawPath = raw['path'] === undefined ? DEFAULT_REST_PATH : raw['path'];
  const path = typeof rawPath === 'string' ? rawPath.trim() : '';

  if (path === '') {
    bag.add(fieldPath('config', 'path'), CODES.pathInvalid);
  }

  return path;
}

/**
 * Validates the REST authentication mode, applying the default when omitted.
 */
function readAuthMode(raw: Record<string, unknown>, bag: FieldErrorBag): AuthMode | null {
  const rawAuthMode = raw['authMode'] === undefined ? 'NONE' : raw['authMode'];
  const authMode = typeof rawAuthMode === 'string' && isAuthMode(rawAuthMode) ? rawAuthMode : null;

  if (authMode === null) {
    bag.add(fieldPath('config', 'authMode'), CODES.authModeUnsupported);
  }

  return authMode;
}

function readMethod(raw: Record<string, unknown>, bag: FieldErrorBag): RequestMethod | null {
  const method = raw['method'] === undefined ? 'GET' : raw['method'];
  if (method === 'GET' || method === 'POST') {
    return method;
  }
  bag.add(fieldPath('config', 'method'), CODES.methodUnsupported);
  return null;
}

/** `undefined`: the body is invalid (reported); `null`: there is none. */
function readRequestBody(
  raw: Record<string, unknown>,
  method: RequestMethod,
  bag: FieldErrorBag,
): Readonly<Record<string, JsonValue>> | null | undefined {
  const body = raw['requestBody'];
  if (body === undefined || body === null) {
    return null;
  }
  const isUsable =
    method === 'POST' &&
    isJsonRecord(body, MAX_REQUEST_BODY_DEPTH) &&
    stringifyJson(body).length <= MAX_REQUEST_BODY_CHARS;
  if (!isUsable) {
    bag.add(fieldPath('config', 'requestBody'), CODES.requestBodyInvalid);
    return undefined;
  }
  return body;
}

/** `undefined`: the path is invalid (reported); `null`: none, detection applies. */
function readRecordsPath(
  raw: Record<string, unknown>,
  bag: FieldErrorBag,
): string | null | undefined {
  const rawPath = raw['recordsPath'];
  if (rawPath === undefined || rawPath === null || rawPath === '') {
    return null;
  }
  const path = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (path === '' || path.length > PAGINATION_LIMITS.maxPathLength || hasUnsafePathSegment(path)) {
    bag.add(fieldPath('config', 'recordsPath'), CODES.recordsPathInvalid);
    return undefined;
  }
  return path;
}

interface RestFields {
  readonly baseUrl: string;
  readonly path: string;
  readonly authMode: AuthMode | null;
  readonly method: RequestMethod | null;
  readonly requestBody: RestConnectionConfig['requestBody'] | undefined;
  readonly recordsPath: string | null | undefined;
  readonly pagination: PaginationStrategy | null;
}

/** Reads every field, so one submit reports ALL invalid ones; an invalid field is `null` or `undefined`. */
function readFields(raw: Record<string, unknown>, bag: FieldErrorBag): RestFields {
  const method = readMethod(raw, bag);
  return {
    baseUrl: readBaseUrl(raw, bag),
    path: readPath(raw, bag),
    authMode: readAuthMode(raw, bag),
    method,
    requestBody: readRequestBody(raw, method ?? 'GET', bag),
    recordsPath: readRecordsPath(raw, bag),
    pagination: checkPaginationStrategy({
      raw: raw['pagination'],
      method: method ?? 'GET',
      bag,
      at: fieldPath('config', 'pagination'),
    }),
  };
}

/** The config when every field was valid, else `null`. */
function assemble(fields: RestFields): RestConnectionConfig | null {
  const { baseUrl, path, authMode, method, requestBody, recordsPath, pagination } = fields;
  if (
    !baseUrl ||
    !path ||
    authMode === null ||
    method === null ||
    requestBody === undefined ||
    recordsPath === undefined ||
    pagination === null
  ) {
    return null;
  }
  return { baseUrl, path, authMode, method, requestBody, recordsPath, pagination };
}

/**
 * Writes every problem of a raw REST config into `bag` and returns the
 * config only when there is none. Shared by `parseRestConnectionConfig`
 * and by the data source draft, so one submit reports ALL invalid fields.
 */
export function checkRestConnectionConfig(
  raw: unknown,
  bag: FieldErrorBag,
): RestConnectionConfig | null {
  if (!isPlainObject(raw)) {
    bag.add('config', CODES.configInvalid);
    return null;
  }

  const hasUnknownKey = Object.keys(raw).some((key) => !ALLOWED_KEYS.has(key));
  if (hasUnknownKey) {
    bag.add('config', CODES.configInvalid);
  }

  const config = assemble(readFields(raw, bag));
  if (hasUnknownKey || config === null) {
    return null;
  }

  const decision = resolveRestEndpoint(config);
  if (!decision.isAllowed) {
    bag.add(fieldPath('config', 'baseUrl'), REJECTION_CODES[decision.reason]);
    return null;
  }

  return config;
}

/**
 * Parses the persisted or submitted config of a REST source. Used both when
 * a source is created and every time it is used, so a blob saved before a
 * rule existed is checked again.
 */
export function parseRestConnectionConfig(
  raw: unknown,
): AppResult<RestConnectionConfig, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const config = checkRestConnectionConfig(raw, bag);
  return bag.hasErrors || config === null ? err(bag.toError()) : ok(config);
}

/**
 * A display-safe label for a stored REST config: origin and path only.
 * The query string and fragment are dropped because they may carry a token.
 */
export function describeRestEndpoint(rawConfig: unknown): string | null {
  const parsed = parseRestConnectionConfig(rawConfig);
  if (parsed.isErr()) {
    return null;
  }
  const decision = resolveRestEndpoint(parsed.value);
  return decision.isAllowed ? `${decision.url.origin}${decision.url.pathname}` : null;
}
