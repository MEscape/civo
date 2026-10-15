import type { ReleaseComponentDependency } from './release-snapshot';
import type { ComponentCatalog } from '../ports/component-catalog.port';

/**
 * How faithfully a release can be shown today. Pages are frozen, but they are
 * drawn by the components registered now: a component that moved on may look
 * different, and one that is gone shows a placeholder.
 *
 * - `exact`: every component is at the version the release was built with.
 * - `changed`: some components have newer versions, so it may look different.
 * - `unavailable`: some components no longer exist.
 */
export type PreviewFidelityStatus = 'exact' | 'changed' | 'unavailable';

export interface PreviewDeviation {
  readonly type: string;
  readonly pinnedVersion: number;
  /** The version registered now; `null` when the component is gone. */
  readonly currentVersion: number | null;
}

export interface PreviewFidelity {
  readonly status: PreviewFidelityStatus;
  /** Only the components that differ, gone ones first. */
  readonly deviations: readonly PreviewDeviation[];
}

export function describePreviewFidelity(
  dependencies: readonly ReleaseComponentDependency[],
  catalog: ComponentCatalog,
): PreviewFidelity {
  const deviations = dependencies
    .map((dependency): PreviewDeviation => ({
      type: dependency.type,
      pinnedVersion: dependency.version,
      currentVersion: catalog.resolve(dependency.type)?.version ?? null,
    }))
    .filter((deviation) => deviation.currentVersion !== deviation.pinnedVersion)
    .sort(
      (a, b) =>
        Number(b.currentVersion === null) - Number(a.currentVersion === null) ||
        a.type.localeCompare(b.type),
    );

  if (deviations.length === 0) {
    return { status: 'exact', deviations };
  }
  return {
    status: deviations.some((deviation) => deviation.currentVersion === null)
      ? 'unavailable'
      : 'changed',
    deviations,
  };
}
