import { isUniqueConstraintViolation, SqlQueryError } from '@prisma/orm-family-sql/errors';

import { infrastructureError } from '@lib/errors';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { type AppResult, err, ok } from '@lib/result';

/** Postgres `exclusion_violation`: a row was refused by an `EXCLUDE` constraint. */
const EXCLUSION_VIOLATION_SQLSTATE = '23P01';

function isExclusionViolation(error: unknown): boolean {
  return SqlQueryError.is(error) && error.sqlState === EXCLUSION_VIOLATION_SQLSTATE;
}

/**
 * Wrapping deeper than this is not something the runtime does; the bound only keeps a chain that
 * loops back on itself from being followed forever.
 */
const MAX_CAUSE_DEPTH = 4;

/**
 * The thrown value and what it was caused by, outermost first. The runtime wraps the normalized
 * driver error as `cause` of its own structured error (and, for a retried prepared statement, one
 * level further), so the driver error is looked for along the chain, not only at the top.
 */
function causeChain(thrown: unknown): unknown[] {
  const chain: unknown[] = [thrown];
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    const last = chain[chain.length - 1];
    if (!(last instanceof Error) || last.cause === undefined) {
      break;
    }
    chain.push(last.cause);
  }
  return chain;
}

/**
 * Whether a write was refused because it collides with another valid write.
 *
 * Only unique and exclusion violations count (an exclusion constraint is a unique constraint over
 * ranges: two bookings for the same time). Foreign-key, not-null and check violations are
 * deliberately not conflicts: they point to a caller bug or a missing domain invariant, not to a
 * race between two valid writes, so they surface as infrastructure failures that get logged and
 * investigated.
 *
 * The package's own predicates are used, never `instanceof`: they match on a stable `kind` field
 * and so survive duplicated package copies and bundler boundaries.
 */
function isConflict(chain: readonly unknown[]): boolean {
  return chain.some(
    (candidate) => isUniqueConstraintViolation(candidate) || isExclusionViolation(candidate),
  );
}

/**
 * What a log line needs to find the cause: the SQLSTATE and the constraint and table the database
 * named. Never `detail`, which can quote the offending row.
 */
function queryDiagnostics(chain: readonly unknown[]): Record<string, string> {
  const query = chain.find((candidate): candidate is SqlQueryError => SqlQueryError.is(candidate));
  if (query === undefined) {
    return {};
  }
  const { sqlState, constraint, table } = query;
  return Object.fromEntries(
    Object.entries({ sqlState, constraint, table }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export interface PersistenceFailureConfig {
  /** Logger context, e.g. `website.persistence`. */
  readonly module: string;
  /** Stable code for this module's infrastructure failures. */
  readonly code: string;
  /** Human-readable subject for messages, e.g. `Website`. */
  readonly subject: string;
}

/**
 * Failure translators for one module's repository: the error boundary persistence.md asks for.
 * Prisma and driver errors never leave it; each translator narrows what was thrown to the kinds a
 * port method may return. A conflict or a miss is an expected outcome and is not logged; every
 * other failure is an infrastructure failure, logged once here, with the thrown error kept as
 * `cause` so diagnostics keep the underlying stack. Its message stays generic (api.md).
 */
export function createPersistenceFailures(config: PersistenceFailureConfig) {
  const log = logger.withContext({ module: config.module });

  function infrastructureFailure(
    thrown: unknown,
    chain: readonly unknown[],
    operation: string,
  ): InfrastructureAppError {
    log.error(`${operation} failed`, thrown, { operation, ...queryDiagnostics(chain) });
    return infrastructureError(
      config.code,
      `${config.subject} persistence failed during ${operation}.`,
      thrown,
    );
  }

  return {
    /** For operations that can only fail on infrastructure (reads, idempotent deletes). */
    infraOnly:
      (operation: string) =>
      (thrown: unknown): InfrastructureAppError =>
        infrastructureFailure(thrown, causeChain(thrown), operation),

    /** For writes that can violate a unique constraint. */
    orConflict:
      <C extends ConflictAppError>(operation: string, onConflict: (thrown: unknown) => C) =>
      (thrown: unknown): C | InfrastructureAppError => {
        const chain = causeChain(thrown);
        return isConflict(chain)
          ? onConflict(thrown)
          : infrastructureFailure(thrown, chain, operation);
      },

    /** For single-row writes: Prisma 8 resolves to `null` when nothing matched. */
    requireRow:
      <N extends NotFoundAppError>(onNotFound: (thrown: unknown) => N) =>
      <R extends object>(row: R | null): AppResult<R, N> =>
        row === null ? err(onNotFound(undefined)) : ok(row),
  };
}
