/**
 * Array helpers. Zero dependencies, no knowledge of any domain concept.
 */

/** Type predicate that removes `null` and `undefined` in `.filter()` without a cast. */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Groups items into a `Map` keyed by the selector result. A `Map` keeps key
 * types honest and avoids prototype-key collisions that plain objects have.
 */
export function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = result.get(key);
    if (group) {
      group.push(item);
    } else {
      result.set(key, [item]);
    }
  }
  return result;
}

/**
 * Indexes items by a unique key. When keys collide the last item wins, so
 * use it only when uniqueness is guaranteed by the caller.
 */
export function keyBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T> {
  const result = new Map<K, T>();
  for (const item of items) {
    result.set(keyFn(item), item);
  }
  return result;
}

/**
 * Splits an array into fixed-size chunks; the last chunk may be smaller.
 * Throws when `size` is not a positive integer, which is a programmer
 * error rather than an expected failure (errors.md).
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError('chunk: size must be a positive integer');
  }
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/** Removes duplicates, optionally comparing by a derived key. First occurrence wins. */
export function unique<T>(items: readonly T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return Array.from(new Set(items));
  }
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Splits items into those matching the predicate and those that do not. */
export function partition<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): [matching: T[], rest: T[]] {
  const matching: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (predicate(item) ? matching : rest).push(item);
  }
  return [matching, rest];
}

/** Builds `[start, start + 1, ..., end - 1]`. Returns an empty array when `end <= start`. */
export function range(start: number, end: number): number[] {
  const length = Math.max(0, Math.ceil(end - start));
  return Array.from({ length }, (_, index) => start + index);
}

/** Moves one item from one index to another without mutating the input. */
export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  if (moved === undefined && fromIndex >= items.length) {
    return result;
  }
  result.splice(toIndex, 0, moved as T);
  return result;
}

/**
 * Builds a type guard for a closed set of string literals. `list.includes`
 * rejects a plain `string` argument, which is why such guards are otherwise
 * hand-written with `.some`.
 */
export function literalGuard<T extends readonly string[]>(
  allowed: T,
): (value: string) => value is T[number] {
  const set: ReadonlySet<string> = new Set(allowed);
  return (value): value is T[number] => set.has(value);
}

/**
 * Returns a copy with `item` inserted at `index`. The index is clamped into
 * `[0, items.length]`; a non-integer index (NaN, Infinity) appends.
 */
export function insertItem<T>(items: readonly T[], index: number, item: T): T[] {
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), items.length) : items.length;
  return [...items.slice(0, at), item, ...items.slice(at)];
}
