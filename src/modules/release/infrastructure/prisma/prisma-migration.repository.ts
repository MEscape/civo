import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  RELEASE_ERROR_CODES,
  releaseMigrationAlreadyApplied,
} from '../../domain/errors/release-errors';
import { serializeConflictResolutions } from '../../domain/models/conflict-resolution';
import { serializeMigrationPlan } from '../../domain/models/stored-migration-plan';

import {
  MIGRATION_RECORD_STATUS,
  MIGRATION_SELECT,
  MIGRATION_SUMMARY_SELECT,
  toMigration,
  toMigrationSummary,
} from './migration-record-mapper';

import type { MigrationRecord } from './migration-record-mapper';
import type { MigrationId, WebsiteId } from '../../domain/models/ids';
import type { Migration, MigrationSummary } from '../../domain/models/migration';
import type {
  MarkApplied,
  MigrationReadError,
  MigrationRepository,
  NewMigration,
} from '../../domain/ports/migration.repository';

const MODULE = 'release.migration.persistence';

const failures = createPersistenceFailures({
  module: MODULE,
  code: RELEASE_ERROR_CODES.persistenceFailed,
  subject: 'Migration',
});

const persistenceLogger = logger.withContext({ module: MODULE });

/**
 * A corrupted plan is an anomaly operations must see, so it is logged
 * here, where it is detected, with ids only.
 */
function restore(
  record: MigrationRecord | null,
): AppResultAsync<Migration | null, MigrationReadError> {
  if (record === null) {
    return okAsync(null);
  }

  const restored = toMigration(record);
  if (restored.isErr()) {
    persistenceLogger.error('release.migration_plan_corrupted', {
      migrationId: record.id,
      websiteId: record.websiteId,
    });
    return errAsync(restored.error);
  }
  return okAsync(restored.value);
}

/**
 * Prisma-backed migration persistence, the only place that touches `db`
 * for migrations. Failure conventions (see `createPersistenceFailures`):
 * reads and plain inserts -> `infraOnly`; the conditional update that
 * closes a migration reports a miss as "already applied".
 */
export class PrismaMigrationRepository implements MigrationRepository {
  create(input: NewMigration): AppResultAsync<MigrationSummary, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteMigration.select(...MIGRATION_SUMMARY_SELECT).create({
          websiteId: input.websiteId,
          sourceReleaseId: input.sourceReleaseId,
          proposedBy: input.proposedBy,
          status: MIGRATION_RECORD_STATUS.proposed,
          plan: serializeMigrationPlan(input.plan),
        }),
      failures.infraOnly('create'),
    ).map(toMigrationSummary);
  }

  findById(
    websiteId: WebsiteId,
    id: MigrationId,
  ): AppResultAsync<Migration | null, MigrationReadError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteMigration.where({ id, websiteId })
          .select(...MIGRATION_SELECT)
          .first(),
      failures.infraOnly('findById'),
    ).andThen(restore);
  }

  listByWebsite(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<readonly MigrationSummary[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteMigration.where({ websiteId })
          .select(...MIGRATION_SUMMARY_SELECT)
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(m) => m.createdAt.desc(), (m) => m.id.desc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).map((records) => records.map(toMigrationSummary));
  }

  markApplied(
    input: MarkApplied,
  ): AppResultAsync<MigrationSummary, ConflictAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteMigration.where({
          id: input.id,
          websiteId: input.websiteId,
          // The condition is what makes two concurrent applies race safely.
          status: MIGRATION_RECORD_STATUS.proposed,
        })
          .select(...MIGRATION_SUMMARY_SELECT)
          .update({
            status: MIGRATION_RECORD_STATUS.applied,
            resolutions: serializeConflictResolutions(input.resolutions),
            appliedBy: input.appliedBy,
            // Prisma 8 does not accept a `Date` for a `DateTime` column.
            appliedAt: dateToInstant(input.appliedAt),
          }),
      failures.infraOnly('markApplied'),
    ).andThen((record): AppResultAsync<MigrationSummary, ConflictAppError> =>
      record === null
        ? errAsync(releaseMigrationAlreadyApplied())
        : okAsync(toMigrationSummary(record)),
    );
  }
}
