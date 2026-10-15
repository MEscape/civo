import { describe, expect, it } from 'vitest';

import {
  describeDraftChanges,
  hasDraftChanges,
} from '@modules/release/domain/models/draft-changes';
import type {
  PublishablePage,
  PublishableWebsite,
} from '@modules/release/domain/models/publishable';
import type { Release } from '@modules/release/domain/models/release';

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

function liveWith(pages: readonly PublishablePage[]): Release {
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
      dependencies: [],
    },
  } as unknown as Release;
}

describe('describeDraftChanges', () => {
  const home = ready('', 'Home', 'Welcome');

  it('finds nothing when the drafts are what is live', () => {
    const changes = describeDraftChanges(liveWith([home]), WEBSITE, [home]);

    expect(hasDraftChanges(changes)).toBe(false);
    expect(changes.pageCount).toBe(1);
  });

  it('tells new, edited and removed pages apart, ordered by path', () => {
    const live = liveWith([home, ready('old', 'Old', 'x'), ready('news', 'News', 'a')]);
    const changes = describeDraftChanges(live, WEBSITE, [
      ready('', 'Home', 'Welcome back'),
      ready('news', 'News', 'a'),
      ready('contact', 'Contact', 'y'),
    ]);

    expect(changes.pageChanges).toEqual([
      { path: '', title: 'Home', kind: 'changed' },
      { path: 'contact', title: 'Contact', kind: 'added' },
      { path: 'old', title: 'Old', kind: 'removed' },
    ]);
  });

  it('counts a renamed page as edited', () => {
    const changes = describeDraftChanges(liveWith([home]), WEBSITE, [
      ready('', 'Start', 'Welcome'),
    ]);

    expect(changes.pageChanges).toEqual([{ path: '', title: 'Start', kind: 'changed' }]);
  });

  it('sees a changed theme and changed website details', () => {
    const changes = describeDraftChanges(
      liveWith([home]),
      {
        ...WEBSITE,
        name: 'Town hall',
        theme: { ...THEME, radius: 'lg' },
      },
      [home],
    );

    expect(changes.websiteChanged).toBe(true);
    expect(changes.themeChanged).toBe(true);
    expect(changes.pageChanges).toEqual([]);
    expect(hasDraftChanges(changes)).toBe(true);
  });

  it('treats everything as new while nothing is live', () => {
    const changes = describeDraftChanges(null, WEBSITE, [home]);

    expect(changes.pageChanges).toEqual([{ path: '', title: 'Home', kind: 'added' }]);
    expect(hasDraftChanges(changes)).toBe(true);
  });

  it('counts a page that cannot be published as blocked, not as changed', () => {
    const broken = { status: 'config_invalid', path: 'news', title: 'News' } as PublishablePage;
    const changes = describeDraftChanges(liveWith([home, ready('news', 'News', 'a')]), WEBSITE, [
      home,
      broken,
    ]);

    expect(changes.blockedPageCount).toBe(1);
    expect(changes.pageChanges).toEqual([]);
  });
});
