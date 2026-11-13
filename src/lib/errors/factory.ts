import type {
  ConflictAppError,
  ForbiddenAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnauthorizedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from './app-error';

/*
 * One constructor per error kind. Prefer these over hand-building an AppError at a call site: the
 * shape stays the same everywhere, and every error site carries a stable `code` that is greppable
 * across logs (observability.md).
 */

/**
 * `fieldErrors` maps a dotted field path (`fieldPath(...)`, or `ROOT_FIELD` for a problem that
 * belongs to no field) to the stable codes of what is wrong with it, never to input values.
 */
export function validationError(
  code: string,
  message: string,
  fieldErrors: Record<string, string[]>,
): ValidationAppError {
  return { kind: 'validation', code, message, fieldErrors };
}

export function notFoundError(code: string, message: string): NotFoundAppError {
  return { kind: 'not_found', code, message };
}

export function conflictError(code: string, message: string): ConflictAppError {
  return { kind: 'conflict', code, message };
}

export function unauthorizedError(code: string, message: string): UnauthorizedAppError {
  return { kind: 'unauthorized', code, message };
}

export function forbiddenError(code: string, message: string): ForbiddenAppError {
  return { kind: 'forbidden', code, message };
}

/** `retryAfterSeconds` is rounded up to a whole second and is never below 1. */
export function rateLimitedError(
  code: string,
  message: string,
  retryAfterSeconds: number,
): RateLimitedAppError {
  return {
    kind: 'rate_limited',
    code,
    message,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
  };
}

/**
 * `message` here is what gets shown to the user via api.md's "do not
 * expose internal exception messages" — pass a safe, generic message and
 * put the real diagnostic detail in `cause`.
 */
export function infrastructureError(
  code: string,
  message: string,
  cause?: unknown,
): InfrastructureAppError {
  return { kind: 'infrastructure', code, message, cause };
}

/** A caught `throw` no caller can recover from. Keep the thrown value as `cause`; `message` stays generic. */
export function unexpectedError(
  code: string,
  message: string,
  cause?: unknown,
): UnexpectedAppError {
  return { kind: 'unexpected', code, message, cause };
}
