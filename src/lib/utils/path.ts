/**
 * Dot-path helpers: reading, writing and validating paths like `"a.b.0.c"`.
 * Depends only on `./object`.
 */

import { isPlainObject } from './object';

/**
 * Property names that must never be traversed or written by a path.
 * Writing through `__proto__` (or `constructor.prototype`) would mutate
 * `Object.prototype` for the whole process.
 */
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

/** True when a single path segment could reach or pollute a prototype. */
export function isUnsafePathSegment(segment: string): boolean {
  return UNSAFE_PATH_SEGMENTS.has(segment);
}

/** Converts bracket indexes to dot form: `items[0].name` -> `items.0.name`. */
export function normalizePath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

/**
 * Splits a path into its segments, accepting bracket indexes.
 * Empty segments are dropped: `"a..b"` -> `["a", "b"]`.
 */
export function pathSegments(path: string): string[] {
  return normalizePath(path).split('.').filter(Boolean);
}

/**
 * True when any segment of the path is unsafe (see `isUnsafePathSegment`).
 * A boolean check for validating paths up front, unlike `setPath`, which throws.
 */
export function hasUnsafePathSegment(path: string): boolean {
  return pathSegments(path).some(isUnsafePathSegment);
}

/** Reads a nested value by dot path (`"a.b.0.c"`). Returns `undefined` when any segment is missing. */
export function getPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    if (!Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment]; // Own-key presence was checked above.
  }
  return current;
}

/**
 * Returns a copy of `obj` with the value at a dot path replaced. Never mutates
 * the input. Missing intermediate segments are created as plain objects.
 * Throws on prototype-polluting segments; validate untrusted paths first with
 * `hasUnsafePathSegment`.
 */
export function setPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown,
): T {
  const segments = path.split('.');
  if (segments.some(isUnsafePathSegment)) {
    throw new Error(`Unsafe path segment in "${path}"`);
  }

  const [head, ...rest] = segments;
  if (head === undefined) {
    return obj;
  }

  const next =
    rest.length === 0
      ? value
      : setPath(isPlainObject(obj[head]) ? obj[head] : {}, rest.join('.'), value);

  return { ...obj, [head]: next };
}
