import { deepEqual } from '@lib/utils';

import type { PageId } from './ids';
import type { PageTree, TreeNode } from './page-tree';

/** A page's current draft, as the builder holds it. */
export interface PageDraft {
  readonly pageId: PageId;
  /** The root page has an empty path. */
  readonly path: string;
  /** The revision this draft is at; send it back as `expectedVersion` when writing. */
  readonly version: number;
  /** `null` when the saved configuration is missing or unreadable: nothing to compare against. */
  readonly children: readonly TreeNode[] | null;
}

/**
 * What one page ended up as. `written` and `already_applied` both mean the
 * draft now holds the migrated tree.
 */
export const PAGE_OUTCOMES = [
  'written',
  'already_applied',
  'draft_diverged',
  'page_missing',
  'failed',
] as const;
export type PageOutcome = (typeof PAGE_OUTCOMES)[number];

export function isSuccessfulOutcome(outcome: PageOutcome): boolean {
  return outcome === 'written' || outcome === 'already_applied';
}

export type DraftVerdict = 'writable' | 'already_applied' | 'diverged';

/**
 * Whether a migrated tree may replace a draft. The migration is computed
 * from the published release, so writing it over a draft that has been
 * edited since would silently discard those edits. It is only written when
 * the draft still equals what was published.
 *
 * A draft that already equals the migrated tree is a retry that has
 * already succeeded, not a divergence.
 */
export function judgeDraft(
  draft: PageDraft,
  published: PageTree,
  migrated: readonly TreeNode[],
): DraftVerdict {
  // A draft that cannot be read is never overwritten: it may hold work.
  if (draft.children === null) {
    return 'diverged';
  }
  if (deepEqual(draft.children, migrated)) {
    return 'already_applied';
  }
  if (deepEqual(draft.children, published.children)) {
    return 'writable';
  }
  return 'diverged';
}
