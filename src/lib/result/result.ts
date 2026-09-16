/**
 * Core Result type used across the service, repository, and data-adapter
 * layers to represent expected operational outcomes without throwing.
 *
 * Unexpected programmer/system errors should still throw and be caught by
 * Next.js error boundaries. `Result` is only for *expected* failure modes
 * (validation errors, not-found, external API failures, etc).
 */
export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

export function ok<T>(data: T): Result<T, never> {
    return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
    return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return result.ok === false;
}

/**
 * Unwraps a Result, returning `data` on success or `fallback` on failure.
 * Useful at the UI boundary where a caller wants a plain value.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
    return result.ok ? result.data : fallback;
}

/**
 * Transforms the success value of a Result, leaving errors untouched.
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    return result.ok ? ok(fn(result.data)) : result;
}

/**
 * Transforms the error value of a Result, leaving success untouched.
 */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : err(fn(result.error));
}

/**
 * Combines an array of Results into a single Result of an array.
 * Returns the first error encountered, if any.
 */
export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const data: T[] = [];
    for (const result of results) {
        if (!result.ok) return result;
        data.push(result.data);
    }
    return ok(data);
}
