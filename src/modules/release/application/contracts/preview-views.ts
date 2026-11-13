import type { ReleaseSummaryView } from './release-views';
import type { PublishedSnapshotView } from './snapshot-views';

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
