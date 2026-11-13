import type { MapChangeView, PageChangeView, ReleaseSummaryView } from './release-views';

export interface ComponentUpdateView {
  /** Optional enrichment: only component instances that still exist in the current draft are linked. */
  readonly editorTargets?: ReadonlyArray<{
    readonly pageId: string;
    readonly nodeId: string;
    readonly path: string;
  }>;
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
    /** Every saved map that differs from the live site, not only the ones listed. */
    readonly mapChangeCount: number;
    /** The first few, by name. */
    readonly mapChanges: readonly MapChangeView[];
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
