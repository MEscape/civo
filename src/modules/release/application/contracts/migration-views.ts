import type { ConflictResolutionsInput } from '../../domain/migration/conflict-resolution';
import type { MigrationStatus } from '../../domain/migration/migration';
import type {
  NodeMigrationPlan,
  NodeMigrationStatus,
  NodeStatusCounts,
} from '../../domain/migration/migration-plan';
import type { PageOutcome } from '../../domain/migration/page-draft';
import type { FieldConflict } from '../../domain/migration/three-way-merge';

/*
 * Migrations: bringing a published release's components up to today's
 * versions, as new drafts.
 */
export type { ConflictResolutionsInput, MigrationStatus, PageOutcome, FieldConflict };

/** Plain, serializable and fully resolved, as consumers see it. */
export type NodeMigrationView = NodeMigrationPlan;

export interface PageMigrationView {
  /** The root page has an empty path. */
  readonly path: string;
  readonly nodes: readonly NodeMigrationView[];
}

/**
 * `requiresReview` and `isUpToDate` are decided here, not by the UI:
 * whether a human has to look first is a business rule.
 */
export interface MigrationPlanView {
  readonly pages: readonly PageMigrationView[];
  readonly counts: NodeStatusCounts;
  readonly requiresReview: boolean;
  readonly isUpToDate: boolean;
}

/**
 * What proposing returns. `migrationId` is `null` for a website that is
 * already up to date: there is nothing to review, so nothing is recorded.
 */
export interface MigrationProposalView {
  readonly migrationId: string | null;
  readonly sourceReleaseId: string;
  readonly plan: MigrationPlanView;
}

export interface MigrationSummaryPageDetailView {
  readonly path: string;
  readonly nodes: ReadonlyArray<{
    readonly nodeId: string;
    readonly type: string;
    readonly fromVersion: number;
    readonly toVersion?: number | undefined;
    readonly status: NodeMigrationStatus;
  }>;
}

/** One row of a website's migration history; carries summary diff information. */
export interface MigrationSummaryView {
  readonly id: string;
  readonly websiteId: string;
  readonly sourceReleaseId: string;
  readonly status: MigrationStatus;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
  readonly pages?: readonly MigrationSummaryPageDetailView[] | undefined;
  readonly changedNodeCount?: number | undefined;
}

export interface MigrationDetailView extends MigrationSummaryView {
  readonly plan: MigrationPlanView;
}

export interface PageOutcomeView {
  readonly path: string;
  readonly outcome: PageOutcome;
}

/**
 * `status` is `applied` only when every changed page now holds the migrated
 * tree. Otherwise the migration stays `proposed` and can be retried; the
 * page outcomes say exactly what happened where.
 */
export interface ApplyMigrationResultView {
  readonly migrationId: string;
  readonly websiteId: string;
  readonly status: MigrationStatus;
  readonly pages: readonly PageOutcomeView[];
  readonly updatedNodeCount: number;
  readonly skippedNodeCount: number;
}
