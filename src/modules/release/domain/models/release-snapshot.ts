import type { JsonValue } from '@lib/utils';

import type { WebsiteId } from './ids';

/**
 * Lets a future migration recognise an older stored shape without guessing
 * from its structure. Bump it whenever a stored field is added, renamed or
 * removed.
 */
export const RELEASE_SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * A page's configuration, frozen at publish time. The builder owns its
 * structure and has already validated it; a release only has to keep it
 * unchanged, so it is opaque JSON here and the release module stays free
 * of the builder's types. The public renderer parses it with the builder's
 * own schema.
 */
export type SnapshotPageConfig = Readonly<Record<string, JsonValue>>;

/**
 * Theme values exactly as they were live at publish time. Plain strings,
 * not the website module's curated unions: a release is history, and must
 * keep rendering after a font or radius leaves the curated list.
 */
export interface ReleaseTheme {
  readonly colors: {
    readonly primary: string;
    readonly secondary: string;
    readonly accent: string;
  };
  readonly typography: {
    readonly headingFont: string;
    readonly bodyFont: string;
  };
  readonly radius: string;
  readonly spacingScale: string;
}

export interface SnapshotWebsite {
  readonly id: WebsiteId;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
}

export interface SnapshotPage {
  /** The root page has an empty path. */
  readonly path: string;
  readonly title: string;
  readonly config: SnapshotPageConfig;
}

/** A contract version a component needed when the release was published. */
export interface ComponentContractPin {
  readonly contract: string;
  readonly minVersion: number;
}

/**
 * One component type used by a release, with the version that was current
 * at publish time. Page configs name components by bare type, so without
 * this record an old release could silently resolve to today's version
 * after the registry moved on. It is a durable record and a publish-time
 * compatibility gate; render time does not enforce the pin yet.
 */
export interface ReleaseComponentDependency {
  readonly type: string;
  readonly version: number;
  readonly contracts: readonly ComponentContractPin[];
}

/**
 * Everything the public site needs to render a website, materialised at
 * publish time. It never references a mutable page row, so a release can
 * be restored later without rebuilding anything.
 */
export interface ReleaseSnapshot {
  readonly schemaVersion: typeof RELEASE_SNAPSHOT_SCHEMA_VERSION;
  readonly website: SnapshotWebsite;
  readonly theme: ReleaseTheme;
  readonly pages: readonly SnapshotPage[];
  /** One entry per distinct component type across the whole release. */
  readonly dependencies: readonly ReleaseComponentDependency[];
}
