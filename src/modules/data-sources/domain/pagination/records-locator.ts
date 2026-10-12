import { getPath, isPlainObject } from '@lib/utils';

/** How many envelope levels automatic detection looks through: `{ data: { items: [...] } }` is two. */
const MAX_ENVELOPE_DEPTH = 3;

/**
 * The property names open-data APIs commonly wrap their list in, most
 * specific first. Detection is a convenience for the well-known shapes only:
 * an API that wraps its list elsewhere is addressed with an explicit
 * `recordsPath`, which always wins.
 */
const ENVELOPE_KEYS = [
  'data',
  'results',
  'result',
  'items',
  'records',
  'rows',
  'entries',
  'content',
  'value',
  'hits',
  'features',
  '_embedded',
] as const;

/**
 * True for an array a response could plausibly be a list of records in: empty,
 * or made of objects. A list of strings or numbers (tags, coordinates) is a
 * property of a record, never the records themselves.
 */
function isRecordArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isPlainObject);
}

/** HAL's `_embedded` holds one array under a name the API chooses. */
function firstEmbeddedList(embedded: Record<string, unknown>): unknown[] | null {
  return Object.values(embedded).find(isRecordArray) ?? null;
}

function detect(body: unknown, depth: number): unknown[] | null {
  if (isRecordArray(body)) {
    return body;
  }
  if (!isPlainObject(body) || depth >= MAX_ENVELOPE_DEPTH) {
    return null;
  }

  for (const key of ENVELOPE_KEYS) {
    const candidate = body[key];
    if (isRecordArray(candidate)) {
      return candidate;
    }
    if (isPlainObject(candidate)) {
      const nested =
        key === '_embedded' ? firstEmbeddedList(candidate) : detect(candidate, depth + 1);
      if (nested !== null) {
        return nested;
      }
    }
  }
  return null;
}

/**
 * The list of records inside an API response, or `null` when the response
 * holds none (the body is then a single record).
 *
 *  - With `recordsPath` (a dot path such as `data.items`), exactly that
 *    location is read: an array is the list, an object is a one-record list.
 *    This is the reliable way and the one to configure when detection is
 *    wrong.
 *  - Without it, a top-level array or one of the common envelopes is
 *    recognised (see `ENVELOPE_KEYS`).
 *
 * The one place the rule lives: the connector (to count a page), discovery
 * and mapping all read it.
 */
export function locateRecords(
  body: unknown,
  recordsPath: string | null = null,
): readonly unknown[] | null {
  if (recordsPath !== null) {
    const located = getPath(body, recordsPath);
    if (Array.isArray(located)) {
      const list: unknown[] = located;
      return list;
    }
    return isPlainObject(located) ? [located] : null;
  }
  return detect(body, 0);
}
