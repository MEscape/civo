import { isJsonValue, parseJson, stringifyJson } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

/**
 * Plain, mutable JSON for a write to a JSON column. Domain values are
 * readonly and may carry `undefined` members; a round trip through JSON text
 * yields exactly what the database will hold. Call it inside the
 * repository's guarded thunk, so a value that is somehow not JSON surfaces
 * as a persistence failure rather than a crash.
 */
export function toJsonValue(value: unknown): JsonValue {
  const plain = parseJson(stringifyJson(value));
  if (!isJsonValue(plain)) {
    throw new TypeError('The value cannot be stored as JSON.');
  }
  return plain;
}
