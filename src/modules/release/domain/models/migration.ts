import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { releaseMigrationAlreadyApplied, releaseMigrationStale } from '../errors/release-errors';

import type { MigrationId, ReleaseId, WebsiteId } from './ids';
import type { MigrationPlan } from './migration-plan';

export const MIGRATION_STATUSES = ['proposed', 'applied'] as const;
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

/** A migration without its plan: what lists need, so history never loads plan JSON. */
export interface MigrationSummary {
  readonly id: MigrationId;
  readonly websiteId: WebsiteId;
  /** The release the plan was computed from. */
  readonly sourceReleaseId: ReleaseId;
  readonly status: MigrationStatus;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
}

/**
 * A reviewed proposal. The plan is stored, not recomputed: applying must
 * write exactly what the reviewer saw, even if the component registry has
 * moved on since. The resolutions chosen at apply time are an audit record
 * only; nothing reads them back, so they are not part of this model.
 */
export interface Migration extends MigrationSummary {
  readonly plan: MigrationPlan;
}

/** A plan is applied once. */
export function ensureApplicable<T extends MigrationSummary>(
  migration: T,
): AppResult<T, ConflictAppError> {
  return migration.status === 'proposed' ? ok(migration) : err(releaseMigrationAlreadyApplied());
}

/** The plan only describes the release it came from; once another is live it is stale. */
export function ensureSourceIsLive<T extends MigrationSummary>(
  migration: T,
  liveReleaseId: ReleaseId,
): AppResult<T, ConflictAppError> {
  return migration.sourceReleaseId === liveReleaseId ? ok(migration) : err(releaseMigrationStale());
}
