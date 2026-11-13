import type { AppError } from './app-error';

/**
 * Exhaustive mapping helper. Passing a handler for every AppErrorKind is
 * enforced at compile time (typescript.md: "use exhaustive checks so
 * adding a new variant produces compile-time errors") — this is the
 * function api.md's Result-to-HTTP-status mapping is built on.
 */
export function matchAppError<T>(
  error: AppError,
  handlers: {
    [K in AppError['kind']]: (error: Extract<AppError, { kind: K }>) => T;
  },
): T {
  // TS cannot narrow `handlers[error.kind]` to a single call signature
  // through an indexed access on a mapped type; the runtime invariant
  // (every handler key matches its own error's `kind`) is what the
  // `[K in AppError['kind']]` constraint on `handlers` already enforces
  // at the call site, so this cast just states that guarantee to the
  // compiler at the one point it can't see it itself.
  const handler = handlers[error.kind] as (error: AppError) => T;
  return handler(error);
}
