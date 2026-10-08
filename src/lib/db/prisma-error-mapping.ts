import { isUniqueConstraintViolation, SqlConnectionError } from '@prisma/orm-family-sql/errors';

import { conflictError, infrastructureError, type AppError } from '@lib/errors';
import { logger } from '@lib/logger';

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });

/**
 * Returns the thrown value and its direct cause. The runtime may hand a
 * repository the driver error itself or wrap it one level deep; checking
 * both keeps this mapper correct either way without walking an unbounded
 * chain.
 */
function withCause(thrown: unknown): readonly unknown[] {
  return thrown instanceof Error && thrown.cause !== undefined ? [thrown, thrown.cause] : [thrown];
}

/**
 * Maps a thrown Prisma runtime error into an AppError.
 *
 * This is the error-mapping boundary required by persistence.md: Prisma
 * and driver errors are an infrastructure concern and must not leak into
 * the application or domain layers. Repositories call this from their
 * catch blocks.
 *
 * `@prisma/orm-postgres` throws two families of error, and each has its
 * own recognizer. Neither is matched with `instanceof`; both use the
 * package's own type predicates, which match on a stable `kind`/`code`
 * field and so survive duplicated package copies and bundler boundaries.
 *
 * - Driver errors (`SqlQueryError`, `SqlConnectionError`) come from
 *   `@prisma/orm-family-sql/errors`. The Postgres driver normalizes every
 *   SQLSTATE error into `SqlQueryError`, so a unique violation is
 *   recognized by `isUniqueConstraintViolation`, which the package
 *   documents as the way to classify one without knowing any
 *   target-specific error shape.
 * - ORM errors are structured envelopes carrying a dotted `NAMESPACE.CODE`
 *   (https://www.prisma.io/docs/orm/v8/reference/error-reference). None of
 *   them is an expected outcome: a single-row write that matches nothing
 *   resolves to `null` and is handled by `requireRow` in
 *   `persistence-failures.ts`, so every ORM error is an infrastructure failure.
 *
 * Only unique violations become `conflictError`. Foreign-key, not-null
 * and check violations are deliberately not mapped to a conflict: they
 * usually indicate a caller bug or a missing invariant in the domain, not
 * a legitimate race between two valid writes, so they surface as
 * infrastructure failures where they get logged and investigated.
 *
 * The original error is preserved as `cause` on every infrastructure
 * error so diagnostics keep the underlying stack.
 */
export function mapPrismaError(
  thrown: unknown,
  context: { code: string; message: string },
): AppError {
  if (typeof thrown === 'object' && thrown !== null && 'kind' in thrown) {
    return thrown as AppError;
  }

  const candidates = withCause(thrown);

  if (candidates.some(isUniqueConstraintViolation)) {
    return conflictError(context.code, context.message);
  }

  if (candidates.some((candidate) => SqlConnectionError.is(candidate))) {
    dbLogger.warn('db.connection_error', { mappedTo: context.code });
  }

  return infrastructureError(context.code, context.message, thrown);
}
