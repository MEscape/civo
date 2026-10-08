/**
 * URL helpers. Zero dependencies.
 */

/** True when the string parses as an absolute URL with one of the allowed protocols (default: http and https). */
export function isValidUrl(
  value: string,
  protocols: readonly string[] = ['http:', 'https:'],
): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** True for same-origin paths such as `/news`; false for absolute or protocol-relative URLs. Guards open redirects. */
export function isRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}

/** Ensures the string ends with exactly one trailing slash. */
export function ensureTrailingSlash(value: string): string {
  return `${value.replace(/\/+$/, '')}/`;
}

/** Removes any trailing slashes. */
export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Joins URL path segments with single slashes, ignoring empty segments.
 * Does not encode; pass already-encoded segments.
 */
export function joinPath(...segments: readonly string[]): string {
  const cleaned = segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0);
  return `/${cleaned.join('/')}`;
}

/** A query value that will be included; arrays repeat the key once per item. */
type QueryValue =
  string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>;

/**
 * Builds a query string from defined values only. `undefined` and `null`
 * entries are skipped, and array values repeat the key.
 */
export function buildQueryString(params: Readonly<Record<string, QueryValue>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}
