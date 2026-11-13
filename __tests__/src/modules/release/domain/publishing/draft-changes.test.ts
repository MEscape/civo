import { describe, expect, it } from 'vitest';

import type { Release } from '@modules/release/domain/models/release';
import {
  describeDraftChanges,
  hasDraftChanges,
} from '@modules/release/domain/publishing/draft-changes';
import type {
  PublishableMap,
  PublishablePage,
  PublishableWebsite,
} from '@modules/release/domain/publishing/publishable';

const THEME = {
  colors: { primary: '#111111', secondary: '#222222', accent: '#333333' },
  typography: { headingFont: 'Inter', bodyFont: 'Inter' },
  radius: 'md',
  spacingScale: 'comfortable',
};

const WEBSITE = {
  id: 'w1',
  name: 'Town',
  slug: 'town',
  description: null,
  theme: THEME,
} as unknown as PublishableWebsite;

function ready(path: string, title: string, text: string): PublishablePage {
  return {
    status: 'ready',
    path,
    title,
    config: { children: [{ type: 'text', text }] },
    componentTypes: ['text'],
  } as unknown as PublishablePage;
}

function savedMap(id: string, name: string, limit = 500): PublishableMap {
  return {
    id,
    name,
    description: null,
    settings: {
      isPublic: true,
      featureLimit: limit,
      layers: [{ datasetId: 'd1', label: 'Buildings' }],
    },
  };
}

function liveWith(
  pages: readonly PublishablePage[],
  maps: readonly PublishableMap[] = [],
): Release {
  return {
    id: 'r1',
    releaseNumber: 1,
    snapshot: {
      website: { id: 'w1', name: 'Town', slug: 'town', description: null },
      theme: THEME,
      pages: pages.flatMap((page) =>
        page.status === 'ready'
          ? [{ path: page.path, title: page.title, config: page.config }]
          : [],
      ),
      maps,
      dependencies: [],
    },
  } as unknown as Release;
}

describe('describeDraftChanges', () => {
  const home = ready('', 'Home', 'Welcome');

  it('finds nothing when the drafts are what is live', () => {
    const changes = describeDraftChanges(liveWith([home]), {
      website: WEBSITE,
      pages: [home],
      maps: [],
    });

    expect(hasDraftChanges(changes)).toBe(false);
    expect(changes.pageCount).toBe(1);
  });

  it('tells new, edited and removed pages apart, ordered by path', () => {
    const live = liveWith([home, ready('old', 'Old', 'x'), ready('news', 'News', 'a')]);
    const changes = describeDraftChanges(live, {
      website: WEBSITE,
      pages: [
        ready('', 'Home', 'Welcome back'),
        ready('news', 'News', 'a'),
        ready('contact', 'Contact', 'y'),
      ],
      maps: [],
    });

    expect(changes.pageChanges).toEqual([
      { path: '', title: 'Home', kind: 'changed' },
      { path: 'contact', title: 'Contact', kind: 'added' },
      { path: 'old', title: 'Old', kind: 'removed' },
    ]);
  });

  it('counts a renamed page as edited', () => {
    const changes = describeDraftChanges(liveWith([home]), {
      website: WEBSITE,
      pages: [ready('', 'Start', 'Welcome')],
      maps: [],
    });

    expect(changes.pageChanges).toEqual([{ path: '', title: 'Start', kind: 'changed' }]);
  });

  it('sees a changed theme and changed website details', () => {
    const changes = describeDraftChanges(liveWith([home]), {
      website: {
        ...WEBSITE,
        name: 'Town hall',
        theme: { ...THEME, radius: 'lg' },
      },
      pages: [home],
      maps: [],
    });

    expect(changes.websiteChanged).toBe(true);
    expect(changes.themeChanged).toBe(true);
    expect(changes.pageChanges).toEqual([]);
    expect(hasDraftChanges(changes)).toBe(true);
  });

  it('treats everything as new while nothing is live', () => {
    const changes = describeDraftChanges(null, { website: WEBSITE, pages: [home], maps: [] });

    expect(changes.pageChanges).toEqual([{ path: '', title: 'Home', kind: 'added' }]);
    expect(hasDraftChanges(changes)).toBe(true);
  });

  it('counts a page that cannot be published as blocked, not as changed', () => {
    const broken = { status: 'config_invalid', path: 'news', title: 'News' } as PublishablePage;
    const changes = describeDraftChanges(liveWith([home, ready('news', 'News', 'a')]), {
      website: WEBSITE,
      pages: [home, broken],
      maps: [],
    });

    expect(changes.blockedPageCount).toBe(1);
    expect(changes.pageChanges).toEqual([]);
  });

  describe('saved maps', () => {
    it('finds nothing when the maps are what is live', () => {
      const maps = [savedMap('m1', 'Buildings')];
      const changes = describeDraftChanges(liveWith([home], maps), {
        website: WEBSITE,
        pages: [home],
        maps,
      });

      expect(changes.mapChanges).toEqual([]);
      expect(hasDraftChanges(changes)).toBe(false);
    });

    it('tells new, edited and removed maps apart, ordered by name', () => {
      const live = liveWith(
        [home],
        [savedMap('m1', 'Buildings'), savedMap('m2', 'Sensors'), savedMap('m3', 'Old')],
      );
      const changes = describeDraftChanges(live, {
        website: WEBSITE,
        pages: [home],
        maps: [
          savedMap('m1', 'Buildings', 100),
          savedMap('m2', 'Sensors'),
          savedMap('m4', 'Districts'),
        ],
      });

      expect(changes.mapChanges).toEqual([
        { id: 'm1', name: 'Buildings', kind: 'changed' },
        { id: 'm4', name: 'Districts', kind: 'added' },
        { id: 'm3', name: 'Old', kind: 'removed' },
      ]);
      expect(changes.pageChanges).toEqual([]);
      expect(hasDraftChanges(changes)).toBe(true);
    });

    it('counts a renamed map as edited', () => {
      const live = liveWith([home], [savedMap('m1', 'Buildings')]);
      const changes = describeDraftChanges(live, {
        website: WEBSITE,
        pages: [home],
        maps: [savedMap('m1', 'Town buildings')],
      });

      expect(changes.mapChanges).toEqual([{ id: 'm1', name: 'Town buildings', kind: 'changed' }]);
    });

    it('reads a release frozen before maps existed as having none', () => {
      const changes = describeDraftChanges(liveWith([home]), {
        website: WEBSITE,
        pages: [home],
        maps: [savedMap('m1', 'Buildings')],
      });

      expect(changes.mapChanges).toEqual([{ id: 'm1', name: 'Buildings', kind: 'added' }]);
    });
  });
});
