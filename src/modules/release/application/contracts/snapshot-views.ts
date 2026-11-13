import type {
  ReleaseComponentDependency,
  ReleaseTheme,
  SnapshotMap,
  SnapshotPage,
} from '../../domain/models/release-snapshot';

/** Plain, serializable and fully resolved, as consumers see it. */
export type ReleaseThemeView = ReleaseTheme;
export type PublishedPageView = SnapshotPage;
export type PublishedMapView = SnapshotMap;
export type ComponentDependencyView = ReleaseComponentDependency;

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
  /** The saved maps the pages may place, exactly as they were at publish time. */
  readonly maps: readonly PublishedMapView[];
  readonly dependencies: readonly ComponentDependencyView[];
}
