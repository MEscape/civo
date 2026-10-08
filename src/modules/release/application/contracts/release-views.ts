import type { ConflictResolutionsInput } from '../../domain/models/conflict-resolution';
import type { MigrationStatus } from '../../domain/models/migration';
import type { NodeMigrationPlan, NodeStatusCounts } from '../../domain/models/migration-plan';
import type { PageOutcome } from '../../domain/models/page-draft';
import type { ReleaseStatus } from '../../domain/models/release';
import type {
  ReleaseComponentDependency,
  ReleaseTheme,
  SnapshotPage,
} from '../../domain/models/release-snapshot';
import type { FieldConflict } from '../../domain/models/three-way-merge';

export type { ReleaseStatus };

/** Plain, serializable and fully resolved, as consumers see it. */
export type ReleaseThemeView = ReleaseTheme;
export type PublishedPageView = SnapshotPage;
export type ComponentDependencyView = ReleaseComponentDependency;

/**
 * One row of a website's release history. `isActive` and `canRollback` are
 * decided here, not by the UI: whether a release may go live is a business
 * rule.
 */
export interface ReleaseSummaryView {
  readonly id: string;
  readonly websiteId: string;
  readonly releaseNumber: number;
  readonly status: ReleaseStatus;
  readonly isActive: boolean;
  readonly canRollback: boolean;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

export interface ReleaseHistoryView {
  readonly activeReleaseId: string | null;
  /** Newest first. */
  readonly releases: readonly ReleaseSummaryView[];
}

/** Everything the public site renders, and nothing about ownership or history. */
export interface PublishedSnapshotView {
  readonly releaseId: string;
  readonly releaseNumber: number;
  readonly website: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
  };
  readonly theme: ReleaseThemeView;
  readonly pages: readonly PublishedPageView[];
  readonly dependencies: readonly ComponentDependencyView[];
}

/** A live release that uses a given component type. */
export interface ComponentUsageView {
  readonly websiteId: string;
  readonly releaseId: string;
  readonly componentVersion: number;
}

export interface PublishReleaseInput {
  readonly websiteId: string;
}

export interface RollbackReleaseInput {
  readonly websiteId: string;
  readonly releaseId: string;
}

export interface FindWebsitesUsingComponentInput {
  readonly componentType: string;
  /** Narrows to websites pinned to exactly this version. */
  readonly version?: number;
}

/*
 * Migrations: bringing a published release's components up to today's
 * versions, as new drafts. Same module, same views file.
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

/** One row of a website's migration history; carries no plan. */
export interface MigrationSummaryView {
  readonly id: string;
  readonly websiteId: string;
  readonly sourceReleaseId: string;
  readonly status: MigrationStatus;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
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

export interface ProposeMigrationInput {
  readonly websiteId: string;
}

export interface ApplyMigrationInput {
  readonly websiteId: string;
  readonly migrationId: string;
  readonly resolutions: ConflictResolutionsInput;
}
