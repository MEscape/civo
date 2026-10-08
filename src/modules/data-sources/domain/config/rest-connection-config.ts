import { fieldPath } from '@lib/errors';
import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import {
  DATA_SOURCE_VALIDATION_CODES,
  createDataSourceErrorBag,
} from '../errors/data-source-errors';
import { isAuthMode } from '../models/data-source-kinds';
import { checkOutboundUrl } from '../rules/outbound-url';

import type { AuthMode } from '../models/data-source-kinds';
import type { OutboundRejection, OutboundUrlDecision } from '../rules/outbound-url';

const CODES = DATA_SOURCE_VALIDATION_CODES;

export interface RestConnectionConfig {
  readonly baseUrl: string;
  /** Appended to `baseUrl` for discovery and fetching. */
  readonly path: string;
  readonly authMode: AuthMode;
}

export const DEFAULT_REST_PATH = '/';

const ALLOWED_KEYS: ReadonlySet<string> = new Set(['baseUrl', 'path', 'authMode']);

const REJECTION_CODES = {
  invalid_url: CODES.baseUrlInvalid,
  scheme_not_allowed: CODES.urlSchemeNotAllowed,
  credentials_not_allowed: CODES.urlCredentialsNotAllowed,
  address_not_allowed: CODES.urlAddressNotAllowed,
} as const satisfies Record<OutboundRejection, string>;

/**
 * Combines `baseUrl` and `path` and applies the SSRF policy to the RESULT.
 *
 * This is the only place the two are combined. `path` may itself be an
 * absolute or protocol-relative URL, in which case `new URL(path, base)`
 * uses the path's own host and silently ignores `baseUrl`, so validating
 * `baseUrl` alone would miss a private target smuggled in through `path`.
 */
export function resolveRestEndpoint(
  config: Pick<RestConnectionConfig, 'baseUrl' | 'path'>,
): OutboundUrlDecision {
  let target: URL;
  try {
    target = new URL(config.path, config.baseUrl);
  } catch {
    return { isAllowed: false, reason: 'invalid_url' };
  }
  return checkOutboundUrl(target.toString());
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

  const baseUrl = readBaseUrl(raw, bag);
  const path = readPath(raw, bag);
  const authMode = readAuthMode(raw, bag);

  if (hasUnknownKey || !baseUrl || !path || authMode === null) {
    return null;
  }

  const config: RestConnectionConfig = { baseUrl, path, authMode };
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
