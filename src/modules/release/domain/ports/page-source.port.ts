import type { AuthorizationError } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, UnexpectedAppError } from '@lib/errors';
import type { AppResult, AppResultAsync } from '@lib/result';

import type { PageId, WebsiteId } from '../models/ids';
import type { PageDraft } from '../models/page-draft';
import type { PageTree, TreeNode } from '../models/page-tree';
import type { PublishablePage } from '../models/publishable';
import type { SnapshotPage } from '../models/release-snapshot';

/**
 * `unexpected` means the builder refused to read a stored page that
 * violates its own invariants. Authorization failures are the builder's own
 * check, which applies on top of ours.
 */
export type PageDraftError = AuthorizationError | InfrastructureAppError | UnexpectedAppError;

export interface ReplaceChildrenInput {
  readonly pageId: PageId;
  /** The revision that was read. A newer one means someone saved in between. */
  readonly expectedVersion: number;
  readonly children: readonly TreeNode[];
}

/**
 * The release module's only view of a website's pages. The builder owns
 * page storage, the component tree, its validation and its revisions; the
 * adapter asks it through its public API. Nothing about a valid tree is
 * decided on this side, and every write is the builder's ordinary,
 * authorized, validated save, never around it.
 */
export interface PageSource {
  /**
   * Every page with its latest saved configuration, reporting per page
   * whether it is usable. Deciding what to do about an unusable page is the
   * domain's job.
   */
  listForRelease(
    websiteId: WebsiteId,
  ): AppResultAsync<readonly PublishablePage[], InfrastructureAppError>;

  /**
   * Reads the trees out of a release's frozen page configurations. `unexpected`
   * when one no longer has the shape the builder published it with: a
   * release is never planned from a partial tree.
   */
  readTrees(pages: readonly SnapshotPage[]): AppResult<readonly PageTree[], UnexpectedAppError>;

  /** Every page's current draft, one read for the whole website. */
  listDrafts(websiteId: WebsiteId): AppResultAsync<readonly PageDraft[], PageDraftError>;

  /** Saves a new revision. A concurrent save surfaces as a conflict. */
  replaceChildren(
    input: ReplaceChildrenInput,
  ): AppResultAsync<void, ConflictAppError | PageDraftError>;
}
