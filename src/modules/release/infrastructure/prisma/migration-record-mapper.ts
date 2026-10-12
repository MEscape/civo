import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { UnexpectedAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { toMigrationId, toReleaseId, toWebsiteId } from '../../domain/models/ids';
import { restoreMigrationPlan } from '../../domain/models/stored-migration-plan';

import type { Migration, MigrationStatus, MigrationSummary } from '../../domain/models/migration';

/**
 * Persistence shapes. They mirror the columns the module reads and
 * nothing else, so no generated database type ever leaves this layer.
 * `resolutions` is write-only (an audit record), so it is never selected.
 */
export interface MigrationSummaryRecord {
  readonly id: string;
  readonly websiteId: string;
  readonly sourceReleaseId: string;
  readonly status: string;
  readonly createdAt: InstantRecord;
  readonly appliedAt: InstantRecord | null;
  readonly plan?: unknown;
}

export interface MigrationRecord extends MigrationSummaryRecord {
  readonly plan: unknown;
}

/** Select only what the use cases need (persistence.md): everything but the plan, which can be large. */
export const MIGRATION_SUMMARY_SELECT = [
  'id',
  'websiteId',
  'sourceReleaseId',
  'status',
  'createdAt',
  'appliedAt',
] as const satisfies ReadonlyArray<keyof MigrationSummaryRecord>;

/** The summary plus the stored plan: for reading one migration, and for the history's change summary. */
export const MIGRATION_SELECT = [
  ...MIGRATION_SUMMARY_SELECT,
  'plan',
] as const satisfies ReadonlyArray<keyof MigrationRecord>;

/** The stored enum spelling of each domain status, for writes. */
export const MIGRATION_RECORD_STATUS = {
  proposed: 'PROPOSED',
  applied: 'APPLIED',
} as const satisfies Record<MigrationStatus, string>;

const isProposedRecord = literalGuard([MIGRATION_RECORD_STATUS.proposed]);

/** A status this build does not know reads as `applied`, so it can never be applied (again). */
function toMigrationStatus(raw: string): MigrationStatus {
  return isProposedRecord(raw) ? 'proposed' : 'applied';
}

/**
 * Without a plan on the record the summary has no change detail. A stored plan
 * this build cannot read degrades the same way: the history row still shows.
 */
export function toMigrationSummary(record: MigrationSummaryRecord): MigrationSummary {
  let pages: MigrationSummary['pages'];
  let changedNodeCount: number | undefined;

  if (record.plan !== undefined) {
    const planResult = restoreMigrationPlan(record.plan);
    if (planResult.isOk()) {
      const plan = planResult.value;
      const resolvedPages = plan.pages.map((p) => ({
        path: p.path,
        nodes: p.nodes
          .filter((n) => n.status !== 'unchanged')
          .map((n) => ({
            nodeId: n.nodeId,
            type: n.type,
            fromVersion: n.fromVersion,
            toVersion: 'toVersion' in n ? n.toVersion : undefined,
            status: n.status,
          })),
      }));
      pages = resolvedPages;
      changedNodeCount = resolvedPages.reduce(
        (sum, p) => sum + p.nodes.filter((n) => n.status !== 'unresolvable').length,
        0,
      );
    }
  }

  return {
    id: toMigrationId(record.id),
    websiteId: toWebsiteId(record.websiteId),
    sourceReleaseId: toReleaseId(record.sourceReleaseId),
    status: toMigrationStatus(record.status),
    createdAt: instantToDate(record.createdAt),
    appliedAt: record.appliedAt === null ? null : instantToDate(record.appliedAt),
    pages,
    changedNodeCount,
  };
}

/** The stored plan goes through the domain's own reader before it reaches a use case. */
export function toMigration(record: MigrationRecord): AppResult<Migration, UnexpectedAppError> {
  return restoreMigrationPlan(record.plan).map((plan) => ({
    ...toMigrationSummary(record),
    plan,
  }));
}
