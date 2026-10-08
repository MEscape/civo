import type { ReleaseId } from './ids';
import type { PageTree } from './page-tree';
import type { Release } from './release';
import type { ReleaseComponentDependency } from './release-snapshot';

/** The component version a release recorded for one type when it was published. */
export type ComponentPin = Pick<ReleaseComponentDependency, 'type' | 'version'>;

/**
 * What a migration is computed from: a published release, frozen. The pins
 * are the only record of "which component version was this node built
 * against"; a draft has none, which is why drafts are never a migration
 * source.
 */
export interface MigrationSource {
  readonly releaseId: ReleaseId;
  readonly pages: readonly PageTree[];
  readonly pins: readonly ComponentPin[];
}

/**
 * The release's own record of its pins plus its page trees. The trees are
 * passed in because reading them out of the opaque stored page
 * configuration is the builder's job (see `PageTreeReader`).
 */
export function toMigrationSource(release: Release, pages: readonly PageTree[]): MigrationSource {
  return {
    releaseId: release.id,
    pages,
    pins: release.snapshot.dependencies.map(({ type, version }) => ({
      type,
      version,
    })),
  };
}
