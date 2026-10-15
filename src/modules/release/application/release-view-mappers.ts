import { pick } from '@lib/utils';

import { hasDraftChanges } from '../domain/models/draft-changes';
import {
  countNodesByStatus,
  isUpToDate,
  requiresReview,
  summarizeComponentUpdates,
} from '../domain/models/migration-plan';
import { canActivate } from '../domain/models/release';

import { PUBLICATION_CHANGE_PREVIEW } from './list-limits';

import type {
  MigrationDetailView,
  MigrationPlanView,
  MigrationProposalView,
  MigrationSummaryView,
  PublicationStatusView,
  PublishedSnapshotView,
  ReleasePreviewView,
  ReleaseHistoryView,
  ReleaseSummaryView,
} from './contracts/release-views';
import type { DraftChanges } from '../domain/models/draft-changes';
import type { ReleaseId } from '../domain/models/ids';
import type { Migration, MigrationSummary } from '../domain/models/migration';
import type { MigrationPlan } from '../domain/models/migration-plan';
import type { PreviewFidelity } from '../domain/models/preview-fidelity';
import type { Release, ReleaseHistory, ReleaseSummary } from '../domain/models/release';
import type { ReleaseNeighbours } from '../domain/ports/release.repository';

export function toReleaseSummaryView(
  summary: ReleaseSummary,
  activeReleaseId: ReleaseId | null,
): ReleaseSummaryView {
  return {
    id: summary.id,
    websiteId: summary.websiteId,
    releaseNumber: summary.releaseNumber,
    status: summary.status,
    isActive: summary.id === activeReleaseId,
    canRollback: canActivate(summary, activeReleaseId),
    note: summary.note,
    publishedBy: summary.publishedBy,
    changes:
      summary.changes === null
        ? null
        : {
            pageChangeCount: summary.changes.pageChanges.length,
            pageChanges: summary.changes.pageChanges.slice(0, PUBLICATION_CHANGE_PREVIEW),
            websiteChanged: summary.changes.websiteChanged,
            themeChanged: summary.changes.themeChanged,
          },
    publishedAt: summary.publishedAt,
    createdAt: summary.createdAt,
  };
}

export function toReleaseHistoryView(history: ReleaseHistory): ReleaseHistoryView {
  return {
    ...history,
    items: history.items.map((summary) => toReleaseSummaryView(summary, history.activeReleaseId)),
  };
}

export function toPublicationStatusView(input: {
  readonly live: Release | null;
  readonly history: ReleaseHistory;
  readonly changes: DraftChanges;
  readonly plan: MigrationPlan | null;
  readonly checkedAt: Date;
}): PublicationStatusView {
  const { live, history, changes, plan, checkedAt } = input;
  const updates = plan === null ? null : summarizeComponentUpdates(plan);

  return {
    checkedAt,
    live: live === null ? null : toReleaseSummaryView(live, live.id),
    releaseCount: history.total,
    nextReleaseNumber: (history.items[0]?.releaseNumber ?? 0) + 1,
    recent: history.items.map((summary) => toReleaseSummaryView(summary, live?.id ?? null)),
    draft: {
      pageCount: changes.pageCount,
      blockedPageCount: changes.blockedPageCount,
      pageChangeCount: changes.pageChanges.length,
      pageChanges: changes.pageChanges.slice(0, PUBLICATION_CHANGE_PREVIEW),
      websiteChanged: changes.websiteChanged,
      themeChanged: changes.themeChanged,
      hasChanges: hasDraftChanges(changes),
    },
    componentUpdates:
      updates === null
        ? null
        : {
            available: updates.filter((update) => update.status !== 'unresolvable').length,
            needReview: updates.filter((update) => update.status === 'needs_review').length,
            unresolvable: updates.filter((update) => update.status === 'unresolvable').length,
            components: updates,
          },
  };
}

export function toReleasePreviewView(input: {
  readonly release: Release;
  readonly neighbours: ReleaseNeighbours;
  readonly fidelity: PreviewFidelity;
}): ReleasePreviewView {
  const { release, neighbours, fidelity } = input;
  return {
    release: toReleaseSummaryView(release, neighbours.activeReleaseId),
    snapshot: toPublishedSnapshotView(release),
    fidelity,
    older: neighbours.older,
    newer: neighbours.newer,
  };
}

export function toPublishedSnapshotView(release: Release): PublishedSnapshotView {
  const { snapshot } = release;
  return {
    releaseId: release.id,
    releaseNumber: release.releaseNumber,
    website: pick(snapshot.website, ['id', 'name', 'slug', 'description']),
    theme: snapshot.theme,
    pages: snapshot.pages,
    dependencies: snapshot.dependencies,
  };
}

export function toMigrationPlanView(plan: MigrationPlan): MigrationPlanView {
  return {
    pages: plan.pages,
    counts: countNodesByStatus(plan),
    requiresReview: requiresReview(plan),
    isUpToDate: isUpToDate(plan),
  };
}

export function toMigrationSummaryView(summary: MigrationSummary): MigrationSummaryView {
  return {
    id: summary.id,
    websiteId: summary.websiteId,
    sourceReleaseId: summary.sourceReleaseId,
    status: summary.status,
    createdAt: summary.createdAt,
    appliedAt: summary.appliedAt,
    pages: summary.pages,
    changedNodeCount: summary.changedNodeCount,
  };
}

export function toMigrationDetailView(migration: Migration): MigrationDetailView {
  return {
    ...toMigrationSummaryView(migration),
    plan: toMigrationPlanView(migration.plan),
  };
}

export function toMigrationProposalView(input: {
  readonly migrationId: string | null;
  readonly sourceReleaseId: ReleaseId;
  readonly plan: MigrationPlan;
}): MigrationProposalView {
  return {
    migrationId: input.migrationId,
    sourceReleaseId: input.sourceReleaseId,
    plan: toMigrationPlanView(input.plan),
  };
}
