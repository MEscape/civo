import 'server-only';

import { notFound } from 'next/navigation';

import type { Result } from '@lib/result';

import { escalate } from './escalate';

import type { AppError } from './app-error';

/**
 * Expected error kinds that should appear as 404 Not Found to prevent cross-tenant resource enumeration.
 * A visitor must not learn whether an id exists in another tenant.
 */
const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
  'not_found',
  'conflict',
]);

/**
 * Unpacks the value of a successful result, or triggers Next.js `notFound()` for
 * authorization, validation, conflict, or not-found errors so that cross-tenant
 * existence is never disclosed.
 *
 * Unexpected, infrastructure, or rate-limited errors are escalated to the nearest
 * route `error.tsx` boundary.
 *
 * Supports both synchronous `Result<T, E>` and asynchronous `PromiseLike<Result<T, E>>`.
 */
export function orNotFound<T, E extends AppError = AppError>(result: Result<T, E>): T;
export function orNotFound<T, E extends AppError = AppError>(
  promise: PromiseLike<Result<T, E>>,
): Promise<T>;
export function orNotFound<T, E extends AppError = AppError>(
  target: Result<T, E> | PromiseLike<Result<T, E>>,
): T | Promise<T> {
  if ('then' in target) {
    return Promise.resolve(target).then((res) => {
      if (res.isErr()) {
        if (NOT_FOUND_KINDS.has(res.error.kind)) {
          notFound();
        }
        escalate(res.error);
      }
      return res.value;
    });
  }
  if (target.isErr()) {
    if (NOT_FOUND_KINDS.has(target.error.kind)) {
      notFound();
    }
    escalate(target.error);
  }
  return target.value;
}
