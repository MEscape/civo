import type { Page } from '@lib/pagination';

import type { ConflictResolutionsInput } from '../../domain/models/conflict-resolution';
import type { MigrationStatus } from '../../domain/models/migration';
import type {
  NodeMigrationPlan,
  NodeMigrationStatus,
  NodeStatusCounts,
} from '../../domain/models/migration-plan';
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
  /** What the editor wrote when publishing; `null` when nothing was. */
  readonly note: string | null;
  /** What it changed against the release before it; `null` for releases made before this was kept. */
  readonly changes: ReleaseChangesView | null;
  /** The actor id of who published it; the screen names them. */
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

/** One page of a website's releases, newest first. */
export interface ReleaseHistoryView extends Page<ReleaseSummaryView> {
  readonly activeReleaseId: string | null;
}

export type PageChangeKindView = 'added' | 'changed' | 'removed';

export interface ReleaseChangesView {
  /** Every page that differed, not only the ones listed. */
  readonly pageChangeCount: number;
  /** The first few, by path. */
  readonly pageChanges: readonly PageChangeView[];
  readonly websiteChanged: boolean;
  readonly themeChanged: boolean;
}

export interface ComponentUpdateView {
  readonly type: string;
  readonly fromVersion: number;
  readonly toVersion: number | null;
  readonly usageCount: number;
  readonly pageCount: number;
  readonly status: 'upgradable' | 'needs_review' | 'unresolvable';
  /** The pages it is on, by path (the home page has an empty one). */
  readonly pagePaths: readonly string[];
  /** Settings the newer version introduces; they start with their default value. */
  readonly addedFields: readonly string[];
  /** Settings a person has to decide about. */
  readonly conflictFields: readonly string[];
}

export interface PageChangeView {
  /** The root page has an empty path. */
  readonly path: string;
  readonly title: string;
  readonly kind: PageChangeKindView;
}

/** Where a website stands between its pages and the live site, for the overview and the release screen. */
export interface PublicationStatusView {
  /** When this was read: it is computed on every request, so this is how fresh it is. */
  readonly checkedAt: Date;
  /** The release the public site serves; `null` until the first publish. */
  readonly live: ReleaseSummaryView | null;
  readonly releaseCount: number;
  /** The number the next release gets. */
  readonly nextReleaseNumber: number;
  /** Newest first. */
  readonly recent: readonly ReleaseSummaryView[];
  readonly draft: {
    readonly pageCount: number;
    /** Pages that stop a publish as they are. */
    readonly blockedPageCount: number;
    /** Every page that differs from the live site, not only the ones listed. */
    readonly pageChangeCount: number;
    /** The first few, by path. */
    readonly pageChanges: readonly PageChangeView[];
    readonly websiteChanged: boolean;
    readonly themeChanged: boolean;
    readonly hasChanges: boolean;
  };
  /** `null` while nothing is live: there is no release to hold against today's components. */
  readonly componentUpdates: {
    /** Components a newer version can replace. */
    readonly available: number;
    /** Of those, the ones a person has to look at first. */
    readonly needReview: number;
    /** Components that cannot be moved to a newer version: it is gone, or the version it was built with is. */
    readonly unresolvable: number;
    /** One line per component that has something to update, the ones needing most attention first. */
    readonly components: readonly ComponentUpdateView[];
  } | null;
}

/** How faithfully today's components can draw an earlier release. */
export interface PreviewFidelityView {
  readonly status: 'exact' | 'changed' | 'unavailable';
  /** Only the components that differ, gone ones first. */
  readonly deviations: ReadonlyArray<{
    readonly type: string;
    readonly pinnedVersion: number;
    readonly currentVersion: number | null;
  }>;
}

export interface ReleaseRefView {
  readonly id: string;
  readonly releaseNumber: number;
}

/** One release as it can be looked at: its pages, its place in the history and how faithfully it can be drawn. */
export interface ReleasePreviewView {
  readonly release: ReleaseSummaryView;
  readonly snapshot: PublishedSnapshotView;
  readonly fidelity: PreviewFidelityView;
  readonly older: ReleaseRefView | null;
  readonly newer: ReleaseRefView | null;
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
  /** What the editor wrote about this release; optional. */
  readonly note?: string | undefined;
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

export interface ProposeMigrationInput {
  readonly websiteId: string;
}

export interface ApplyMigrationInput {
  readonly websiteId: string;
  readonly migrationId: string;
  readonly resolutions: ConflictResolutionsInput;
}
