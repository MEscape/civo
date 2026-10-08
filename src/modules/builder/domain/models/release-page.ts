import type { PageId } from './ids';
import type { PageConfig } from './page-config';

/**
 * What a publisher can do with a page's latest saved configuration.
 * Deciding what to do about an unusable page is the publisher's job; the
 * builder only reports the fact, so a damaged page never blocks reading
 * the rest of a website.
 */
export type ReleasePageState =
  | { readonly status: 'ready'; readonly config: PageConfig }
  /** The page was never saved. */
  | { readonly status: 'config_missing' }
  /** The stored JSON no longer satisfies the page invariants. */
  | { readonly status: 'config_invalid' };

export interface ReleasePage {
  readonly pageId: PageId;
  /** The latest saved revision: what a trusted writer sends back as `expectedVersion`. */
  readonly version: number;
  readonly path: string;
  readonly title: string;
  readonly state: ReleasePageState;
}
