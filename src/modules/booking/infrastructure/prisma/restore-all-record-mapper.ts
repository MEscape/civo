import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

/**
 * Restores every record or fails on the first one that cannot be restored.
 * A damaged row is reported rather than silently left out of a list: a
 * missing resource or booking would quietly change what the engine offers.
 */
export function restoreAll<R, T>(
  records: readonly R[],
  restore: (record: R) => AppResult<T, InfrastructureAppError>,
): AppResult<readonly T[], InfrastructureAppError> {
  const restored: T[] = [];
  for (const record of records) {
    const result = restore(record);
    if (result.isErr()) {
      return err(result.error);
    }
    restored.push(result.value);
  }
  return ok(restored);
}
