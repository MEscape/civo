/**
 * Function combinators. Zero dependencies.
 */

/** Delays calls until `waitMs` has passed without another call. Only the last call's arguments are used. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = undefined;
  };

  return debounced;
}

/** Runs the first call immediately, then ignores calls until `waitMs` has passed. */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let lastCall = Number.NEGATIVE_INFINITY;
  return (...args: Args): void => {
    const now = Date.now();
    if (now - lastCall >= waitMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

/** Runs `fn` at most once and returns the cached result on every later call. */
export function once<T>(fn: () => T): () => T {
  let called = false;
  let result: T;
  return () => {
    if (!called) {
      result = fn();
      called = true;
    }
    return result;
  };
}

/**
 * Caches results by the first argument (compared with `Map` semantics). The
 * cache never expires, so use it only for pure functions over a bounded set
 * of inputs (caching.md: every cache needs an invalidation strategy — an
 * unbounded, permanent cache is only appropriate when the input domain
 * itself is bounded, e.g. memoizing a formatter over a small enum).
 */
export function memoize<Arg, Result>(fn: (arg: Arg) => Result): (arg: Arg) => Result {
  const cache = new Map<Arg, Result>();
  return (arg) => {
    if (cache.has(arg)) {
      return cache.get(arg) as Result;
    } // has() guarantees presence.
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

/** Returns its argument unchanged. Useful as a default transform. */
export function identity<T>(value: T): T {
  return value;
}

/** Does nothing. Useful as a default callback. */
export function noop(): void {
  // Intentionally empty.
}
