import { describe, expect, it } from 'vitest';

import { loadMapUsage } from '@modules/map/presentation/loaders/load-map-usage';
import type { MapUsageReaders } from '@modules/map/presentation/loaders/load-map-usage';

import { errAsync, okAsync } from '@lib/result';

function readers(overrides: Partial<MapUsageReaders> = {}): MapUsageReaders {
  return {
    drafts: () =>
      okAsync({
        byMap: {
          m1: [{ pageId: 'p1', title: 'Home', components: [{ nodeId: 'n1', type: 'map' }] }],
        },
        awaiting: [{ pageId: 'p2', title: 'Town', nodeId: 'n9', type: 'map' }],
        isTruncated: false,
      }),
    live: () => okAsync({ m1: [{ title: 'Home' }], m2: [{ title: 'Old' }] }),
    labels: () => Promise.resolve({ map: 'Map' }),
    editorHref: (websiteId, pageId) => `/w/${websiteId}/builder/${pageId}`,
    componentHref: (websiteId, pageId, nodeId) =>
      `/w/${websiteId}/builder/${pageId}?select=${nodeId}`,
    releasesHref: (websiteId) => `/w/${websiteId}/releases`,
    ...overrides,
  };
}

describe('loadMapUsage', () => {
  it('links each component placing a map, adds the live pages, and the blocks still waiting', async () => {
    const screen = await loadMapUsage('site', 'en', readers());

    expect(screen.usage).toEqual({
      m1: [
        {
          title: 'Home',
          href: '/w/site/builder/p1',
          isLive: false,
          components: [{ label: 'Map', href: '/w/site/builder/p1?select=n1' }],
        },
        { title: 'Home', href: '/w/site/releases', isLive: true, components: [] },
      ],
      m2: [{ title: 'Old', href: '/w/site/releases', isLive: true, components: [] }],
    });
    expect(screen.awaiting).toEqual([
      { label: 'Map', page: 'Town', href: '/w/site/builder/p2?select=n9' },
    ]);
  });

  it('is unknown when the pages may not be read, could not be read, or were cut short', async () => {
    const unknown = { usage: null, awaiting: [] };
    expect(await loadMapUsage('site', 'en', null)).toEqual(unknown);
    expect(
      await loadMapUsage(
        'site',
        'en',
        readers({
          drafts: () => errAsync({ kind: 'forbidden', code: 'auth.permission_denied' } as never),
        }),
      ),
    ).toEqual(unknown);
    expect(
      await loadMapUsage(
        'site',
        'en',
        readers({ live: () => errAsync({ kind: 'infrastructure' } as never) }),
      ),
    ).toEqual(unknown);
    expect(
      await loadMapUsage(
        'site',
        'en',
        readers({ drafts: () => okAsync({ byMap: {}, awaiting: [], isTruncated: true }) }),
      ),
    ).toEqual(unknown);
  });
});
