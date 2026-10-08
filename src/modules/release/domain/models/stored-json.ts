import { invariant, isJsonValue, parseJson, stringifyJson } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

/**
 * The plain JSON a JSON column can hold. A round trip, because the domain
 * keeps absent values as `undefined`, which JSON cannot represent. The one
 * place this is done, so every stored shape is built the same way.
 */
export function toStoredJson(value: unknown): JsonValue {
  const json = parseJson(stringifyJson(value));
  invariant(isJsonValue(json), 'A stored value must serialize to JSON.');
  return json;
}
