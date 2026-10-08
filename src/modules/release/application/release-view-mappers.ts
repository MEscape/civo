import { pick } from '@lib/utils';

import { countNodesByStatus, isUpToDate, requiresReview } from '../domain/models/migration-plan';
import { canActivate } from '../domain/models/release';

import type {
  MigrationDetailView,
  MigrationPlanView,
  MigrationProposalView,
  MigrationSummaryView,
  PublishedSnapshotView,
  ReleaseHistoryView,
  ReleaseSummaryView,
} from './contracts/release-views';
import type { ReleaseId } from '../domain/models/ids';
import type { Migration, MigrationSummary } from '../domain/models/migration';
import type { MigrationPlan } from '../domain/models/migration-plan';
import type { Release, ReleaseHistory, ReleaseSummary } from '../domain/models/release';

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
    publishedAt: summary.publishedAt,
    createdAt: summary.createdAt,
  };
}

export function toReleaseHistoryView(history: ReleaseHistory): ReleaseHistoryView {
  return {
    activeReleaseId: history.activeReleaseId,
    releases: history.releases.map((summary) =>
      toReleaseSummaryView(summary, history.activeReleaseId),
    ),
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
