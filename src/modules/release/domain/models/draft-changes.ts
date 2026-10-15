import { deepEqual } from '@lib/utils';

import type { PublishablePage, PublishableWebsite } from './publishable';
import type { Release } from './release';
import type { PageChange, ReleaseChanges } from './release-changes';
import type { SnapshotWebsite } from './release-snapshot';

/** What publishing now would change on the live site. */
export interface DraftChanges extends ReleaseChanges {
  /** Pages the website has today. */
  readonly pageCount: number;
  /** Pages that stop a publish as they are: never saved, or no longer valid. */
  readonly blockedPageCount: number;
}

export function hasDraftChanges(changes: DraftChanges): boolean {
  return changes.pageChanges.length > 0 || changes.websiteChanged || changes.themeChanged;
}

function detailsDiffer(live: SnapshotWebsite, website: PublishableWebsite): boolean {
  return (
    live.name !== website.name ||
    live.slug !== website.slug ||
    live.description !== website.description
  );
}

function byPath(a: PageChange, b: PageChange): number {
  return a.path.localeCompare(b.path);
}

/**
 * Compares today's pages and settings with the live release, the same way a
 * publish would read them. Without a live release everything is new. A page
 * that cannot be published is counted as blocked, not as changed: nothing of
 * it would go live.
 */
export function describeDraftChanges(
  live: Release | null,
  website: PublishableWebsite,
  pages: readonly PublishablePage[],
): DraftChanges {
  const liveByPath = new Map((live?.snapshot.pages ?? []).map((page) => [page.path, page]));
  const draftPaths = new Set(pages.map((page) => page.path));

  const fromDrafts = pages.flatMap((page): PageChange[] => {
    if (page.status !== 'ready') {
      return [];
    }
    const published = liveByPath.get(page.path);
    if (published === undefined) {
      return [{ path: page.path, title: page.title, kind: 'added' }];
    }
    const isSame = published.title === page.title && deepEqual(published.config, page.config);
    return isSame ? [] : [{ path: page.path, title: page.title, kind: 'changed' }];
  });
  const removed = [...liveByPath.values()]
    .filter((page) => !draftPaths.has(page.path))
    .map((page): PageChange => ({ path: page.path, title: page.title, kind: 'removed' }));

  const snapshot = live?.snapshot;
  return {
    pageCount: pages.length,
    pageChanges: [...fromDrafts, ...removed].sort(byPath),
    websiteChanged: snapshot === undefined || detailsDiffer(snapshot.website, website),
    themeChanged: snapshot === undefined || !deepEqual(snapshot.theme, website.theme),
    blockedPageCount: pages.filter((page) => page.status !== 'ready').length,
  };
}
