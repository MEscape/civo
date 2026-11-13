import { isPlainObject } from '@lib/utils';

/**
 * Keys that must never appear in a log line, redacted regardless of
 * nesting depth. security.md / observability.md: "never log credentials,
 * tokens, session secrets, or sensitive personal data."
 *
 * A key is redacted when it CONTAINS one of these words, in any casing:
 * `accessToken`, `x-api-key`, `newPassword`, `Set-Cookie` and `AUTH_SECRET`
 * carry credentials as surely as `token` does, and an exact-name list lets
 * every spelling it did not foresee through. Over-redacting a harmless key
 * costs a log field; under-redacting leaks a credential.
 */
const REDACTED_KEY_PATTERN =
  /pass(?:word|wd|phrase)|token|secret|api[-_]?key|private[-_]?key|authorization|cookie|credit[-_]?card|cvv/i;

/** Deeper than any log context is meant to be; bounds the recursion on hostile or accidental nesting. */
const MAX_REDACTION_DEPTH = 8;

/**
 * Opaque: keep it recognizable in the log line without pretending to
 * redact fields inside it. Errors are handled separately via the
 * `error` field on LogEntry, so a bare Error reaching here is already
 * an edge case, not the primary path.
 */
function describeOpaque(value: object): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional fallback for opaque objects
  return String(value);
}

/**
 * A copy of `value` that is safe to serialize: sensitive keys redacted, cycles
 * and over-deep nesting cut off, `bigint` as text (`JSON.stringify` throws on it).
 * `ancestors` is the path from the root, not everything seen: an object
 * referenced twice from different places is data, only a reference to one of
 * its own ancestors is a cycle.
 */
export function redact(value: unknown, ancestors: readonly object[] = []): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (ancestors.includes(value)) {
    return '[Circular]';
  }
  if (ancestors.length >= MAX_REDACTION_DEPTH) {
    return '[Truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, [...ancestors, value]));
  }

  if (!isPlainObject(value)) {
    return describeOpaque(value);
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = REDACTED_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redact(val, [...ancestors, value]);
  }
  return result;
}
