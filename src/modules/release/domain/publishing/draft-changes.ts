import { deepEqual } from '@lib/utils';

import type { PublishableMap, PublishablePage, PublishableWebsite } from './publishable';
import type { MapChange, PageChange, ReleaseChanges } from './release-changes';
import type { Release } from '../models/release';
import type { SnapshotWebsite } from '../models/release-snapshot';

/** What publishing now would change on the live site. */
export interface DraftChanges extends ReleaseChanges {
  /** Pages the website has today. */
  readonly pageCount: number;
  /** Pages that stop a publish as they are: never saved, or no longer valid. */
  readonly blockedPageCount: number;
}

export function hasDraftChanges(changes: DraftChanges): boolean {
  return (
    changes.pageChanges.length > 0 ||
    changes.mapChanges.length > 0 ||
    changes.websiteChanged ||
    changes.themeChanged
  );
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

function byName(a: MapChange, b: MapChange): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** A map is the same when what a visitor sees of it is: its name, description and settings. */
function describeMapChanges(live: Release | null, maps: readonly PublishableMap[]): MapChange[] {
  const liveById = new Map((live?.snapshot.maps ?? []).map((map) => [map.id, map]));
  const draftIds = new Set(maps.map((map) => map.id));

  const fromDrafts = maps.flatMap((map): MapChange[] => {
    const published = liveById.get(map.id);
    if (published === undefined) {
      return [{ id: map.id, name: map.name, kind: 'added' }];
    }
    const isSame =
      published.name === map.name &&
      published.description === map.description &&
      deepEqual(published.settings, map.settings);
    return isSame ? [] : [{ id: map.id, name: map.name, kind: 'changed' }];
  });
  const removed = [...liveById.values()]
    .filter((map) => !draftIds.has(map.id))
    .map((map): MapChange => ({ id: map.id, name: map.name, kind: 'removed' }));

  return [...fromDrafts, ...removed].sort(byName);
}

/**
 * Compares today's pages, maps and settings with the live release, the same way a
 * publish would read them. Without a live release everything is new. A page
 * that cannot be published is counted as blocked, not as changed: nothing of
 * it would go live.
 */
export function describeDraftChanges(
  live: Release | null,
  draft: {
    readonly website: PublishableWebsite;
    readonly pages: readonly PublishablePage[];
    readonly maps: readonly PublishableMap[];
  },
): DraftChanges {
  const { website, pages, maps } = draft;
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
    mapChanges: describeMapChanges(live, maps),
    websiteChanged: snapshot === undefined || detailsDiffer(snapshot.website, website),
    themeChanged: snapshot === undefined || !deepEqual(snapshot.theme, website.theme),
    blockedPageCount: pages.filter((page) => page.status !== 'ready').length,
  };
}
