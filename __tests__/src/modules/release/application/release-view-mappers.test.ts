import { describe, expect, it } from 'vitest';

import {
  toMigrationDetailView,
  toMigrationPlanView,
  toMigrationProposalView,
  toMigrationSummaryView,
  toPublicationStatusView,
  toReleaseHistoryView,
  toReleasePreviewView,
  toReleaseSummaryView,
} from '@modules/release/application/release-view-mappers';
import type { MigrationSummary } from '@modules/release/domain/migration/migration';
import type { MigrationPlan } from '@modules/release/domain/migration/migration-plan';
import { toMigrationId, toReleaseId, toWebsiteId } from '@modules/release/domain/models/ids';
import type { Release, ReleaseSummary } from '@modules/release/domain/models/release';
import type { DraftChanges } from '@modules/release/domain/publishing/draft-changes';
import type { PreviewFidelity } from '@modules/release/domain/publishing/preview-fidelity';

import { toPage } from '@lib/pagination';

const websiteId = toWebsiteId('web-1');
const releaseId = toReleaseId('rel-1');
const otherReleaseId = toReleaseId('rel-2');
const now = new Date('2026-06-01T12:00:00Z');

const summary: ReleaseSummary = {
  id: releaseId,
  websiteId,
  releaseNumber: 1,
  status: 'published',
  note: 'Initial release',
  publishedBy: 'admin-1',
  publishedAt: now,
  createdAt: now,
  changes: {
    pageChanges: [
      { path: '', kind: 'added', title: 'Home' },
      { path: 'contact', kind: 'changed', title: 'Contact' },
    ],
    mapChanges: [{ id: 'm1', name: 'Buildings', kind: 'added' }],
    websiteChanged: true,
    themeChanged: false,
  },
};

const release: Release = {
  ...summary,
  snapshot: {
    schemaVersion: 2,
    website: { id: websiteId, name: 'My City', slug: 'my-city', description: 'Official site' },
    theme: {
      colors: { primary: '#0055aa', secondary: '#112233', accent: '#ff8800' },
      typography: { headingFont: 'Inter', bodyFont: 'Inter' },
      radius: 'md',
      spacingScale: 'comfortable',
    },
    pages: [{ path: '', title: 'Home', config: { children: [] } }],
    maps: [{ id: 'm1', name: 'Buildings', description: null, settings: { isPublic: true } }],
    dependencies: [{ type: 'hero', version: 2, contracts: [] }],
  },
};

const upgradablePlan: MigrationPlan = {
  pages: [
    {
      path: '',
      nodes: [
        {
          nodeId: 'n1',
          type: 'hero',
          status: 'upgradable',
          fromVersion: 1,
          toVersion: 2,
          mergedProps: {},
          addedFields: [],
        },
      ],
    },
  ],
};

describe('toReleaseSummaryView', () => {
  it('says which release is live and whether this one can be restored', () => {
    const live = toReleaseSummaryView(summary, releaseId);
    expect(live.isActive).toBe(true);
    expect(live.canRollback).toBe(false);
    expect(live.changes?.pageChangeCount).toBe(2);

    const earlier = toReleaseSummaryView(summary, otherReleaseId);
    expect(earlier.isActive).toBe(false);
    expect(earlier.canRollback).toBe(true);
  });

  it('keeps a release without a change record as one', () => {
    expect(toReleaseSummaryView({ ...summary, changes: null }, null).changes).toBeNull();
  });
});

describe('toReleaseHistoryView', () => {
  it('keeps the page and marks the live release among its items', () => {
    const view = toReleaseHistoryView({
      ...toPage([summary], 1, { page: 1, pageSize: 10 }),
      activeReleaseId: releaseId,
    });

    expect(view.total).toBe(1);
    expect(view.items[0]?.isActive).toBe(true);
  });
});

describe('toPublicationStatusView', () => {
  const draft: DraftChanges = {
    pageCount: 3,
    blockedPageCount: 0,
    pageChanges: [{ path: 'faq', kind: 'added', title: 'FAQ' }],
    mapChanges: [],
    websiteChanged: false,
    themeChanged: true,
  };

  it('reports the live release, the waiting changes and the components that can be updated', () => {
    const view = toPublicationStatusView({
      live: release,
      history: { ...toPage([summary], 1, { page: 1, pageSize: 3 }), activeReleaseId: releaseId },
      changes: draft,
      plan: upgradablePlan,
      checkedAt: now,
      editorPages: [
        {
          status: 'ready',
          pageId: 'draft-home',
          path: '',
          title: 'Home',
          componentTypes: ['hero'],
          config: { type: 'page', children: [] },
        },
      ],
      editorTrees: [
        { path: '', children: [{ id: 'hero-current', type: 'hero', props: {}, children: [] }] },
      ],
    });

    expect(view.checkedAt).toEqual(now);
    expect(view.live?.id).toBe(releaseId);
    expect(view.nextReleaseNumber).toBe(2);
    expect(view.draft.hasChanges).toBe(true);
    expect(view.componentUpdates?.available).toBe(1);
    expect(view.componentUpdates?.components[0]?.editorTargets).toEqual([
      { pageId: 'draft-home', nodeId: 'hero-current', path: '' },
    ]);
  });

  it('has no component update state while nothing is live', () => {
    const view = toPublicationStatusView({
      live: null,
      history: { ...toPage([], 0, { page: 1, pageSize: 3 }), activeReleaseId: null },
      changes: { ...draft, pageChanges: [], themeChanged: false },
      plan: null,
      checkedAt: now,
    });

    expect(view.live).toBeNull();
    expect(view.nextReleaseNumber).toBe(1);
    expect(view.draft.hasChanges).toBe(false);
    expect(view.componentUpdates).toBeNull();
  });
});

describe('toReleasePreviewView', () => {
  it('carries the snapshot without what only the website module owns', () => {
    const fidelity: PreviewFidelity = { status: 'exact', deviations: [] };
    const view = toReleasePreviewView({
      release,
      neighbours: { activeReleaseId: releaseId, older: null, newer: null },
      fidelity,
    });

    expect(view.release.id).toBe(releaseId);
    expect(view.fidelity).toBe(fidelity);
    expect(view.snapshot.website).toEqual({
      id: websiteId,
      name: 'My City',
      slug: 'my-city',
      description: 'Official site',
    });
    expect(view.snapshot.pages).toHaveLength(1);
  });
});

describe('migration views', () => {
  const migration: MigrationSummary = {
    id: toMigrationId('mig-1'),
    websiteId,
    sourceReleaseId: releaseId,
    status: 'applied',
    createdAt: now,
    appliedAt: now,
    pages: [{ path: '', nodes: [] }],
    changedNodeCount: 1,
  };

  it('counts a plan by status and says whether a person has to look first', () => {
    const view = toMigrationPlanView(upgradablePlan);

    expect(view.pages).toEqual(upgradablePlan.pages);
    expect(view.counts.upgradable).toBe(1);
    expect(view.requiresReview).toBe(false);
    expect(view.isUpToDate).toBe(false);
  });

  it('maps a summary, a detail with its plan, and a proposal', () => {
    expect(toMigrationSummaryView(migration).id).toBe(migration.id);
    expect(
      toMigrationDetailView({ ...migration, plan: upgradablePlan }).plan.counts.upgradable,
    ).toBe(1);

    const proposal = toMigrationProposalView({
      migrationId: 'mig-1',
      sourceReleaseId: releaseId,
      plan: upgradablePlan,
    });
    expect(proposal.migrationId).toBe('mig-1');
    expect(proposal.plan.counts.upgradable).toBe(1);
  });
});
