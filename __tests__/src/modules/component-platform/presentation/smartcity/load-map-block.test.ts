import { describe, expect, it, vi } from 'vitest';

import { loadMapBlock } from '@modules/component-platform/presentation/components/smartcity/map/load-map-block';
import type { SavedMapDraft } from '@modules/map/client';

vi.mock('@modules/map/client', () => ({ DEFAULT_MAP_BOUNDS: [-180, -85, 180, 85] }));

const WEBSITE = '00000000-0000-4000-8000-000000000001';
const MAP = '00000000-0000-4000-8000-000000000002';

const FROZEN: SavedMapDraft = {
  name: 'Frozen',
  description: null,
  settings: {
    isPublic: true,
    pointStyle: 'circles',
    interaction: 'details',
    height: 'standard',
    showFilters: true,
    showLegend: true,
    featureLimit: 100,
    initialBounds: [9, 50, 11, 52],
    layers: [{ datasetId: 'd1', label: 'Buildings' }],
  },
};

const PROPS = {
  savedMapId: MAP,
  primaryDatasetId: 'legacy-inline',
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
  height: 'standard',
} as never;

const request = (context: Parameters<typeof loadMapBlock>[0]['context']) => ({
  props: PROPS,
  context,
  loadContent: vi.fn(),
  heading: 'Map',
  labels: { primary: 'Primary', secondary: 'Secondary' },
});

describe('loadMapBlock: saved maps', () => {
  it('reads the stored map in the editor', async () => {
    const block = await loadMapBlock(request({ mode: 'draft', websiteId: WEBSITE }));

    expect(block.savedMap).toEqual({ websiteId: WEBSITE, mapId: MAP });
    expect(block.inlineMap).toBeUndefined();
  });

  it('reads the stored map in the editor preview, which a release has not frozen yet', async () => {
    const block = await loadMapBlock(
      request({ mode: 'published', websiteId: WEBSITE, isPreview: true }),
    );

    expect(block.savedMap).toEqual({ websiteId: WEBSITE, mapId: MAP });
    expect(block.inlineMap).toBeUndefined();
  });

  it('draws the copy a release froze on a published page, never the stored map', async () => {
    const block = await loadMapBlock(
      request({ mode: 'published', websiteId: WEBSITE, publishedMaps: { [MAP]: FROZEN } }),
    );

    expect(block.savedMap).toBeUndefined();
    expect(block.inlineMap).toEqual({ websiteId: WEBSITE, mode: 'published', draft: FROZEN });
  });

  it.each([
    ['the release does not hold the map', { 'another-map': FROZEN }],
    ['the release holds no maps at all', undefined],
  ])('draws nothing, and not the inline fallback, when %s', async (_name, publishedMaps) => {
    const loadContent = vi.fn();
    const block = await loadMapBlock({
      ...request({ mode: 'published', websiteId: WEBSITE, publishedMaps }),
      loadContent,
    });

    expect(block.savedMap).toBeUndefined();
    expect(block.inlineMap).toBeUndefined();
    expect(loadContent).not.toHaveBeenCalled();
  });
});
