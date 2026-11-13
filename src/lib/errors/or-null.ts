import 'server-only';

import type { Result } from '@lib/result';

import { escalate } from './escalate';

import type { AppError } from './app-error';

/** The refusals that mean "this is not for you, or not there": a block that is optional shows nothing. */
const ABSENT_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
  'not_found',
  'conflict',
]);

/**
 * For a block of a screen that may simply be absent (a card on an overview the actor may not see):
 * the value, or `null` when the actor may not see it or it is not there. Anything unexpected still
 * reaches the route's error boundary, so a real failure is never turned into an empty block.
 */
export async function orNull<T, E extends AppError = AppError>(
  pending: Result<T, E> | PromiseLike<Result<T, E>>,
): Promise<T | null> {
  const result = await pending;
  if (result.isOk()) {
    return result.value;
  }
  return ABSENT_KINDS.has(result.error.kind) ? null : escalate(result.error);
}
