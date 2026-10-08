import type { ActorId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, UnexpectedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ConflictResolutions } from '../models/conflict-resolution';
import type { MigrationId, ReleaseId, WebsiteId } from '../models/ids';
import type { Migration, MigrationSummary } from '../models/migration';
import type { MigrationPlan } from '../models/migration-plan';

/** Reading a plan can also fail because the stored JSON is corrupted. */
export type MigrationReadError = InfrastructureAppError | UnexpectedAppError;

export interface NewMigration {
  readonly websiteId: WebsiteId;
  readonly sourceReleaseId: ReleaseId;
  readonly proposedBy: ActorId;
  readonly plan: MigrationPlan;
}

export interface MarkApplied {
  readonly id: MigrationId;
  readonly websiteId: WebsiteId;
  readonly appliedBy: ActorId;
  readonly appliedAt: Date;
  /** Stored as an audit record only; nothing reads it back. */
  readonly resolutions: ConflictResolutions;
}

/**
 * Persistence for migrations: an audit trail and the reviewed plan. Nothing
 * here is read by rendering or publishing.
 *
 * Callers authorize through the website first; every lookup is then matched
 * on (id, websiteId), so another website's migration id behaves exactly like
 * an id that does not exist. Finders return `null` for "absent"; deciding
 * that absence is an error is the use case's job. Adapters translate every
 * driver failure into our own error kinds before returning (errors.md).
 */
export interface MigrationRepository {
  create(input: NewMigration): AppResultAsync<MigrationSummary, InfrastructureAppError>;

  findById(
    websiteId: WebsiteId,
    id: MigrationId,
  ): AppResultAsync<Migration | null, MigrationReadError>;

  /** Bounded: never returns more than `limit` items, newest first (performance.md). */
  listByWebsite(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<readonly MigrationSummary[], InfrastructureAppError>;

  /**
   * Moves a PROPOSED migration to APPLIED in one conditional update, so two
   * concurrent applies cannot both succeed. A miss means it is no longer
   * proposed, which surfaces as a conflict.
   */
  markApplied(
    input: MarkApplied,
  ): AppResultAsync<MigrationSummary, ConflictAppError | InfrastructureAppError>;
}
