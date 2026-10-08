import { infrastructureError } from '@lib/errors';
import type {
  AppError,
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
} from '@lib/errors';
import { logger } from '@lib/logger';
import { type AppResult, err, ok } from '@lib/result';

import { mapPrismaError } from './prisma-error-mapping';

export interface PersistenceFailureConfig {
  /** Logger context, e.g. `website.persistence`. */
  readonly module: string;
  /** Stable code for this module's infrastructure failures. */
  readonly code: string;
  /** Human-readable subject for messages, e.g. `Website`. */
  readonly subject: string;
}

/**
 * Failure translators for one module's repository. `mapPrismaError`
 * classifies the driver error; each translator narrows it to the kinds a
 * port method may return. Only infrastructure failures are logged, once,
 * here; conflicts and misses are expected outcomes.
 */
export function createPersistenceFailures(config: PersistenceFailureConfig) {
  const log = logger.withContext({ module: config.module });
  const messageFor = (operation: string) =>
    `${config.subject} persistence failed during ${operation}.`;

  function classify(thrown: unknown, operation: string): AppError {
    return mapPrismaError(thrown, {
      code: config.code,
      message: messageFor(operation),
    });
  }

  function toInfrastructure(
    thrown: unknown,
    mapped: AppError,
    operation: string,
  ): InfrastructureAppError {
    log.error(`${operation} failed`, thrown, { operation });
    return mapped.kind === 'infrastructure'
      ? mapped
      : infrastructureError(config.code, messageFor(operation), thrown);
  }

  return {
    /** For operations that can only fail on infrastructure (reads, idempotent deletes). */
    infraOnly:
      (operation: string) =>
      (thrown: unknown): InfrastructureAppError =>
        toInfrastructure(thrown, classify(thrown, operation), operation),

    /** For writes that can violate a unique constraint. */
    orConflict:
      <C extends ConflictAppError>(operation: string, onConflict: (thrown: unknown) => C) =>
      (thrown: unknown): C | InfrastructureAppError => {
        const mapped = classify(thrown, operation);
        return mapped.kind === 'conflict'
          ? onConflict(thrown)
          : toInfrastructure(thrown, mapped, operation);
      },

    /** For single-row writes: Prisma 8 resolves to `null` when nothing matched. */
    requireRow:
      <N extends NotFoundAppError>(onNotFound: (thrown: unknown) => N) =>
      <R extends object>(row: R | null): AppResult<R, N> =>
        row === null ? err(onNotFound(undefined)) : ok(row),
  };
}
