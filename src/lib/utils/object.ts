/**
 * Object helpers. Zero dependencies.
 */

/** True for objects created by `{}` or `new Object()`; false for arrays, `Date`, `Map`, class instances, and `null`. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Own-property check that narrows the key. Unlike `in`, it ignores the prototype chain. */
export function hasOwnKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.hasOwn(obj, key);
}

/** Removes keys whose value is `undefined`. Explicit `null` values are kept. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>; // Object.fromEntries widens the key type to string.
}

/** Returns a new object containing only the listed keys. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>; // Filled below for exactly the keys in Pick<T, K>.
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Returns a new object without the listed keys. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const excluded = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !excluded.has(key))) as Omit<
    T,
    K
  >; // Object.fromEntries widens the key type to string.
}

/** Maps each own value while keeping the keys. */
export function mapValues<T, U>(
  obj: Readonly<Record<string, T>>,
  fn: (value: T, key: string) => U,
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(value, key)]));
}

/**
 * Structural equality for plain JSON-shaped values: primitives, arrays, and
 * plain objects. Does not handle `Map`, `Set`, `Date`, or cyclic structures.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) {
      return false;
    }
    return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Recursively merges plain objects. Arrays and non-plain values from `source`
 * replace those in `target` rather than being merged. Returns a new object.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];
    result[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  }
  return result as T; // The merge preserves T's top-level keys by construction.
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
 * Prototype-polluting segments are rejected.
 */
export function setPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown,
): T {
  const segments = path.split('.');
  if (segments.some((s) => s === '__proto__' || s === 'constructor' || s === 'prototype')) {
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

/** Keys whose value is not `undefined`. `null` counts as a value, like `omitUndefined`. */
export function definedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.entries(obj)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key) as Array<keyof T>; // Object.entries widens the key type to string.
}

/** Keys whose value differs between two records, including keys present on only one side. */
export function changedKeys(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !deepEqual(before[key], after[key]));
}
