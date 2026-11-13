import type { ReleasePreviewView } from '@modules/release/application/contracts/preview-views';
import type {
  ReleaseHistoryView,
  ReleaseSummaryView,
} from '@modules/release/application/contracts/release-views';

import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';

export const LIVE_RELEASE: ReleaseSummaryView = {
  id: 'r2',
  websiteId: 'w1',
  releaseNumber: 2,
  status: 'published',
  isActive: true,
  canRollback: false,
  note: 'Contact page reworked',
  publishedBy: 'actor-anna',
  changes: {
    pageChangeCount: 2,
    pageChanges: [
      { path: '', title: 'Home', kind: 'changed' },
      { path: 'booking', title: 'Booking', kind: 'added' },
    ],
    mapChangeCount: 0,
    mapChanges: [],
    websiteChanged: false,
    themeChanged: false,
  },
  publishedAt: new Date('2026-10-12T10:00:00.000Z'),
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
};

export const EARLIER_RELEASE: ReleaseSummaryView = {
  id: 'r1',
  websiteId: 'w1',
  releaseNumber: 1,
  status: 'published',
  isActive: false,
  canRollback: true,
  note: null,
  publishedBy: null,
  changes: null,
  publishedAt: new Date('2026-10-11T10:00:00.000Z'),
  createdAt: new Date('2026-10-11T10:00:00.000Z'),
};

export const AUTHORS = { 'actor-anna': 'Anna Müller' };

/** A page of the release history with the live release first. */
export function historyOf(
  items: readonly ReleaseSummaryView[] = [LIVE_RELEASE, EARLIER_RELEASE],
  {
    total = items.length,
    request = { page: 1, pageSize: 10 },
  }: { total?: number; request?: PageRequest } = {},
): ReleaseHistoryView {
  return { ...toPage(items, total, request), activeReleaseId: 'r2' };
}

/** A release preview as the application hands it over: the live release with a home page and an about page. */
export function previewViewOf(overrides: Partial<ReleasePreviewView> = {}): ReleasePreviewView {
  return {
    release: LIVE_RELEASE,
    snapshot: {
      releaseId: 'r2',
      releaseNumber: 2,
      website: { id: 'w1', name: 'City', slug: 'city', description: null },
      theme: {
        colors: { primary: '#000', secondary: '#111', accent: '#222' },
        typography: { headingFont: 'Inter', bodyFont: 'Inter' },
        radius: 'md',
        spacingScale: 'comfortable',
      },
      pages: [
        { path: '', title: 'Start', config: {} },
        { path: 'about', title: 'About us', config: {} },
      ],
      maps: [],
      dependencies: [],
    },
    fidelity: { status: 'exact', deviations: [] },
    older: { id: 'r1', releaseNumber: 1 },
    newer: null,
    ...overrides,
  };
}
