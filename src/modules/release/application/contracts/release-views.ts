import type { Page } from '@lib/pagination';

import type { ReleaseStatus } from '../../domain/models/release';

export type { ReleaseStatus };

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
  /** Every saved map that differed, not only the ones listed. */
  readonly mapChangeCount: number;
  /** The first few, by name. */
  readonly mapChanges: readonly MapChangeView[];
  readonly websiteChanged: boolean;
  readonly themeChanged: boolean;
}

export interface MapChangeView {
  readonly id: string;
  readonly name: string;
  readonly kind: PageChangeKindView;
}

export interface PageChangeView {
  /** The root page has an empty path. */
  readonly path: string;
  readonly title: string;
  readonly kind: PageChangeKindView;
}
