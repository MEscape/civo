import type { WebsiteId } from './ids';
import type { ReleaseTheme, SnapshotPageConfig } from './release-snapshot';

/**
 * The input shapes below are what the release module needs from other
 * modules, stated in its own terms. Adapters in infrastructure translate
 * to them, so no foreign type ever enters domain or application.
 */
export interface PublishableWebsite {
  readonly id: WebsiteId;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly theme: ReleaseTheme;
}

interface PublishablePageBase {
  readonly path: string;
  readonly title: string;
}

/** The page has a configuration the builder accepted. */
export interface ReadyPublishablePage extends PublishablePageBase {
  readonly status: 'ready';
  readonly config: SnapshotPageConfig;
  /** Distinct component types used anywhere in the page tree. */
  readonly componentTypes: readonly string[];
}

/** The page was never saved. */
export interface ConfigMissingPublishablePage extends PublishablePageBase {
  readonly status: 'config_missing';
}

/** The latest saved configuration fails the builder's validation. */
export interface ConfigInvalidPublishablePage extends PublishablePageBase {
  readonly status: 'config_invalid';
}

export type PublishablePage =
  ReadyPublishablePage | ConfigMissingPublishablePage | ConfigInvalidPublishablePage;

export interface ComponentContract {
  readonly contract: string;
  /** What the component needs. */
  readonly minVersion: number;
  /** What is available right now. */
  readonly currentVersion: number;
}

export interface ResolvedComponent {
  readonly type: string;
  readonly version: number;
  readonly contracts: readonly ComponentContract[];
}

/** `null` for a type that is not registered at all. */
export type ComponentResolver = (type: string) => ResolvedComponent | null;
