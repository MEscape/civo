import { describe, expect, it, vi } from 'vitest';

import { loadDatasetUsage } from '@modules/data-sources/presentation/loaders/load-dataset-usage';
import type { DatasetUsageReaders } from '@modules/data-sources/presentation/loaders/load-dataset-usage';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const MAPS = {
  items: [
    {
      id: 'map-1',
      name: 'Stations',
      settings: { layers: [{ datasetId: 'dataset' }, { datasetId: 'dataset' }] },
    },
  ],
  total: 1,
};

function readers(isTruncated = false, maps = MAPS): DatasetUsageReaders {
  return {
    drafts: {
      execute: () =>
        okAsync({
          byDataset: {
            dataset: [
              {
                pageId: 'page-1',
                title: 'News',
                components: [{ nodeId: 'node-1', type: 'newsList' }],
              },
            ],
          },
          awaiting: [
            {
              pageId: 'page-2',
              title: 'Home',
              nodeId: 'node-2',
              type: 'newsList',
              kind: 'NewsItem',
            },
          ],
          isTruncated,
        }),
    },
    live: { execute: () => okAsync({ dataset: [{ title: 'Published news' }] }) },
    maps: { execute: () => okAsync(maps) },
    labels: vi.fn(async () => ({ newsList: 'News list' })),
    editorHref: (_website, page) => `/editor/${page}`,
    componentHref: (_website, page, node) => `/editor/${page}?select=${node}`,
    releasesHref: () => '/releases',
    mapHref: (_website, map) => `/maps/${map}`,
  };
}

describe('dataset usage loading', () => {
  it('combines draft, live and map usage, and points awaiting components at their editor', async () => {
    const view = await loadDatasetUsage('website-1', 'en', readers());
    expect(view.state).toBe('complete');
    expect(view.usage?.['dataset']).toEqual([
      {
        title: 'News',
        href: '/editor/page-1',
        where: 'draft',
        components: [{ label: 'News list', href: '/editor/page-1?select=node-1' }],
      },
      { title: 'Published news', href: '/releases', where: 'live', components: [] },
      // Two layers of one dataset are one use of the map.
      { title: 'Stations', href: '/maps/map-1', where: 'map', components: [] },
    ]);
    expect(view.awaiting).toEqual([
      { label: 'News list', page: 'Home', kind: 'NewsItem', href: '/editor/page-2?select=node-2' },
    ]);
  });

  it('never describes unseen pages as unused when draft usage is truncated', async () => {
    const input = readers(true);
    const view = await loadDatasetUsage('website-1', 'en', input);
    expect(view).toEqual({ usage: null, awaiting: [], state: 'incomplete' });
    expect(input.labels).not.toHaveBeenCalled();
  });

  it('never describes unseen maps as unused when the map list is longer than one read', async () => {
    const view = await loadDatasetUsage('website-1', 'en', readers(false, { ...MAPS, total: 101 }));
    expect(view).toEqual({ usage: null, awaiting: [], state: 'incomplete' });
  });

  it('reads usage as unavailable when the saved maps cannot be read', async () => {
    const view = await loadDatasetUsage('website-1', 'en', {
      ...readers(),
      maps: { execute: () => errAsync(infrastructureError('map.failed', 'Unavailable.')) },
    });
    expect(view.state).toBe('unavailable');
  });

  it('distinguishes unavailable usage from an empty, complete read', async () => {
    const input = readers();
    const view = await loadDatasetUsage('website-1', 'en', {
      ...input,
      live: { execute: () => errAsync(infrastructureError('release.failed', 'Unavailable.')) },
    });
    expect(view).toEqual({ usage: null, awaiting: [], state: 'unavailable' });
  });
});
