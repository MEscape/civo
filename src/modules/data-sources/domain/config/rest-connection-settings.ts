import { isPlainObject, pick } from '@lib/utils';

import { parseRestConnectionConfig } from './rest-connection-config';

/** Pagination settings the form has no field for; a change that keeps the kind keeps them. */
const KEPT_PAGINATION_KEYS = ['placement', 'firstPage'];

/**
 * The base URL as an edit form may show it. A query string or fragment can carry a token, so it
 * is cut off; `hasHiddenParts` says that the stored address holds more than is shown.
 */
export function editableBaseUrl(baseUrl: string): {
  readonly baseUrl: string;
  readonly hasHiddenParts: boolean;
} {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { baseUrl: '', hasHiddenParts: false };
  }
  const hasHiddenParts = url.search !== '' || url.hash !== '';
  return { baseUrl: hasHiddenParts ? `${url.origin}${url.pathname}` : baseUrl, hasHiddenParts };
}

/**
 * The config an edit stores: the submitted settings over the stored ones. The form edits the base
 * URL, authentication, records path and pagination; the path, method and request body stay as
 * stored. A base URL submitted exactly as `editableBaseUrl` showed it keeps the stored one, so its
 * hidden query survives; any other value replaces it. The result is validated like a new config.
 */
export function mergeRestSettings(stored: unknown, submitted: unknown): unknown {
  const current = parseRestConnectionConfig(stored);
  if (!isPlainObject(submitted) || current.isErr()) {
    return submitted;
  }
  const { baseUrl, path, method, requestBody, pagination } = current.value;
  const merged: Record<string, unknown> = { path, method, requestBody, ...submitted };
  if (submitted['baseUrl'] === editableBaseUrl(baseUrl).baseUrl) {
    merged['baseUrl'] = baseUrl;
  }
  const next = submitted['pagination'];
  if (isPlainObject(next) && next['kind'] === pagination.kind) {
    const kept: Readonly<Record<string, unknown>> = pagination;
    merged['pagination'] = { ...pick(kept, KEPT_PAGINATION_KEYS), ...next };
  }
  return merged;
}
