import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapConfig, MapLayerInput } from '@modules/map';
import { MapExplorer } from '@modules/map/presentation/components/map-explorer.client';
import enMap from '@modules/map/presentation/i18n/en.json';
import type {
  CreateMapRenderer,
  MapRenderer,
  RenderLayer,
  RendererOptions,
} from '@modules/map/presentation/mapbox/create-mapbox-renderer';

import { districtsLayer, layer, parkingLayer, point, prepareMap } from './fixtures';

const push = vi.hoisted(() => vi.fn());
// Only the router needs replacing: it requires a mounted Next.js app router.
vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ push }),
}));

const CONFIG: MapConfig = {
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
};
const TILES = { accessToken: 'pk.test', styleUrl: 'mapbox://styles/mapbox/light-v11' };

/** Stands in for Mapbox: records what the module asks the renderer to do. */
function fakeRenderer() {
  const calls = {
    layers: [] as Array<readonly RenderLayer[]>,
    selected: [] as Array<string | null>,
    shown: [] as unknown[],
    destroyed: 0,
  };
  const box: { options: RendererOptions | null } = { options: null };
  const create: CreateMapRenderer = (options) => {
    box.options = options;
    const renderer: MapRenderer = {
      setLayers: (layers) => calls.layers.push(layers),
      setSelected: (key) => calls.selected.push(key),
      showBounds: (bounds) => calls.shown.push(bounds),
      destroy: () => {
        calls.destroyed += 1;
      },
    };
    return Promise.resolve(renderer);
  };
  return { create, calls, box };
}

interface Setup {
  readonly inputs?: readonly MapLayerInput[];
  readonly config?: Partial<MapConfig>;
  readonly tiles?: typeof TILES | null;
  readonly unavailableLayers?: number;
  readonly create?: CreateMapRenderer;
}

function renderMap({
  inputs = [parkingLayer()],
  config = {},
  tiles = TILES,
  unavailableLayers = 0,
  create,
}: Setup = {}) {
  const fake = fakeRenderer();
  const merged = { ...CONFIG, ...config };
  const model = prepareMap(inputs, merged);
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMap} timeZone="UTC">
      <MapExplorer
        heading="Parking"
        model={model}
        interaction={merged.interaction}
        showLegend={merged.showLegend}
        height="standard"
        tiles={tiles}
        unavailableLayers={unavailableLayers}
        createRenderer={create ?? fake.create}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, fake };
}

const lastLayers = (fake: ReturnType<typeof fakeRenderer>) => fake.calls.layers.at(-1) ?? [];
const featureCount = (layers: readonly RenderLayer[]) =>
  layers.reduce((sum, entry) => sum + entry.features.length, 0);

async function ready(fake: ReturnType<typeof fakeRenderer>) {
  await waitFor(() => {
    expect(fake.box.options).not.toBeNull();
  });
  act(() => {
    fake.box.options?.onReady();
  });
}

beforeEach(() => {
  push.mockClear();
});

describe('loading, ready and failure states', () => {
  it('announces loading until the renderer reports ready', async () => {
    const { fake } = renderMap();

    expect(screen.getByText('Loading map…')).toBeInTheDocument();

    await ready(fake);
    expect(screen.queryByText('Loading map…')).not.toBeInTheDocument();
  });

  it('hands the renderer the model, not raw data, and destroys it on unmount', async () => {
    const { fake, unmount } = renderMap();
    await ready(fake);

    expect(featureCount(lastLayers(fake))).toBe(4);
    expect(fake.box.options?.accessToken).toBe('pk.test');
    expect(fake.box.options?.initialBounds).toEqual([10, 51, 10.03, 51.03]);

    unmount();
    expect(fake.calls.destroyed).toBe(1);
  });

  it('names the map region and points to the list alternative', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const group = screen.getByRole('group', { name: 'Map: Parking' });
    expect(group).toHaveAccessibleDescription(
      'The locations on this map are also available as a list below the map.',
    );
  });

  it('keeps everything but the background when no map token is configured', () => {
    const create = vi.fn<CreateMapRenderer>();
    renderMap({ tiles: null, create });

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText(/map background is not available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Feature a on the map' })).toBeInTheDocument();
  });

  it('falls back to the list when the renderer reports a failure', async () => {
    const { fake } = renderMap();
    await waitFor(() => {
      expect(fake.box.options).not.toBeNull();
    });
    act(() => {
      fake.box.options?.onFailure();
    });

    expect(screen.getByText(/map could not be displayed/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Map: Parking' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Feature a on the map' })).toBeInTheDocument();
  });

  it('falls back to the list when the renderer cannot be created at all', async () => {
    renderMap({ create: () => Promise.reject(new Error('WebGL unavailable')) });
    expect(await screen.findByText(/map could not be displayed/i)).toBeInTheDocument();
  });

  it('says so when a dataset exists but has no usable locations', () => {
    const create = vi.fn<CreateMapRenderer>();
    renderMap({ inputs: [layer('empty', [])], create });

    expect(screen.getByText('There are no locations to show on this map yet.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('reports invalid records instead of hiding them', () => {
    renderMap({
      inputs: [
        layer('l', [
          point('ok', 10, 51),
          point('bad', 10, 999),
          { id: 'none', label: 'None', attributes: {} },
        ]),
      ],
    });
    expect(screen.getByText('2 entries of 3 could not be placed on the map.')).toBeInTheDocument();
    expect(screen.getByText('Location missing: 1')).toBeInTheDocument();
    expect(screen.getByText('Coordinates outside the valid range: 1')).toBeInTheDocument();
  });

  it('reports data layers that could not be loaded', () => {
    renderMap({ unavailableLayers: 1 });
    expect(screen.getByText('One data layer is temporarily unavailable.')).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('are generated from the data and narrow the map and the list together', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const status = screen.getByRole('group', { name: 'Status' });
    fireEvent.click(within(status).getByRole('checkbox', { name: 'available (2)' }));

    expect(featureCount(lastLayers(fake))).toBe(2);
    expect(screen.getByText('2 of 4 locations shown')).toBeInTheDocument();
    expect(screen.getByText('1 filter active')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show Feature b on the map' }),
    ).not.toBeInTheDocument();
  });

  it('filters by a numeric range with labelled inputs', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const value = screen.getByRole('group', { name: 'Value' });
    fireEvent.change(within(value).getByLabelText('Minimum'), { target: { value: '3' } });

    expect(featureCount(lastLayers(fake))).toBe(2);
  });

  it('filters by date', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const observed = screen.getByRole('group', { name: 'Observed at' });
    fireEvent.change(within(observed).getByLabelText('From'), { target: { value: '2025-03-03' } });

    expect(featureCount(lastLayers(fake))).toBe(2);
  });

  it('say when nothing matches, and can be reset', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const status = screen.getByRole('group', { name: 'Status' });
    fireEvent.click(within(status).getByRole('checkbox', { name: 'full (1)' }));
    fireEvent.change(
      within(screen.getByRole('group', { name: 'Value' })).getByLabelText('Minimum'),
      { target: { value: '5' } },
    );

    expect(screen.getByText('No locations match the current filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(featureCount(lastLayers(fake))).toBe(4);
  });

  it('are not shown when the map is configured without them', () => {
    renderMap({ config: { showFilters: false } });
    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });

  it('are not shown for a dataset with nothing to filter by', () => {
    renderMap({ inputs: [layer('l', [point('a', 10, 51), point('b', 10, 52)])] });
    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });
});

describe('legend', () => {
  it('explains each colour in words, with counts, and is named', () => {
    renderMap();

    const legend = screen.getByRole('region', { name: 'Legend' });
    expect(within(legend).getByText('available')).toBeInTheDocument();
    expect(within(legend).getByText('full')).toBeInTheDocument();
    expect(within(legend).getByText('limited')).toBeInTheDocument();
    expect(within(legend).getByText('Size shows Value: from 0 to 12')).toBeInTheDocument();
  });

  it('describes a numeric colour scale for assistive technology', () => {
    renderMap({ config: { colorBy: 'value' } });
    expect(screen.getByRole('img', { name: 'Value: from 0 to 12' })).toBeInTheDocument();
  });

  it('can be switched off', () => {
    renderMap({ config: { showLegend: false } });
    expect(screen.queryByRole('region', { name: 'Legend' })).not.toBeInTheDocument();
  });

  it('names each layer when several datasets share the map', () => {
    renderMap({ inputs: [parkingLayer(), districtsLayer()] });
    const legend = screen.getByRole('region', { name: 'Legend' });
    expect(within(legend).getByText('Layer: Layer parking')).toBeInTheDocument();
    expect(within(legend).getByText('Areas (1)')).toBeInTheDocument();
  });
});

describe('selecting a feature', () => {
  it('from the list shows its details as text, moves the map and exposes the selected state', async () => {
    const { fake } = renderMap();
    await ready(fake);

    const item = screen.getByRole('button', { name: 'Show Feature a on the map' });
    expect(item).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(item);

    const details = screen.getByRole('complementary', { name: 'Selected location' });
    expect(within(details).getByRole('heading', { name: 'Feature a' })).toBeInTheDocument();
    expect(within(details).getByText('Status')).toBeInTheDocument();
    expect(within(details).getByText('available')).toBeInTheDocument();
    expect(within(details).getByText('Mar 1, 2025, 8:00 AM')).toBeInTheDocument();
    expect(details).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Show Feature a on the map' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(fake.calls.selected.at(-1)).toBe('parking:a');
    expect(fake.calls.shown).toHaveLength(1);
  });

  it('from the map shows the details without moving the view', async () => {
    const { fake } = renderMap();
    await ready(fake);

    act(() => {
      fake.box.options?.onSelect('parking:c');
    });

    expect(screen.getByRole('heading', { name: 'Feature c' })).toBeInTheDocument();
    expect(fake.calls.shown).toHaveLength(0);
  });

  it('closes with the close button or Escape and clears the highlight', async () => {
    const { fake } = renderMap();
    await ready(fake);
    act(() => {
      fake.box.options?.onSelect('parking:a');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(
      screen.queryByRole('complementary', { name: 'Selected location' }),
    ).not.toBeInTheDocument();
    expect(fake.calls.selected.at(-1)).toBeNull();

    act(() => {
      fake.box.options?.onSelect('parking:b');
    });
    fireEvent.keyDown(screen.getByRole('complementary', { name: 'Selected location' }), {
      key: 'Escape',
    });
    expect(
      screen.queryByRole('complementary', { name: 'Selected location' }),
    ).not.toBeInTheDocument();
  });

  it('is dropped when the selected feature is filtered out', async () => {
    const { fake } = renderMap();
    await ready(fake);
    act(() => {
      fake.box.options?.onSelect('parking:b');
    });

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('checkbox', {
        name: 'available (2)',
      }),
    );
    expect(
      screen.queryByRole('complementary', { name: 'Selected location' }),
    ).not.toBeInTheDocument();
  });

  it("offers a real link for a feature that has one, keeping the visitor's locale for site pages", async () => {
    const { fake } = renderMap({
      inputs: [
        layer('l', [
          point('a', 10, 51, {}, { href: '/services/parking' }),
          point('b', 10, 52, {}, { href: 'https://example.org/x' }),
        ]),
      ],
    });
    await ready(fake);

    act(() => {
      fake.box.options?.onSelect('l:a');
    });
    expect(screen.getByRole('link', { name: 'Open page for Feature a' })).toHaveAttribute(
      'href',
      '/en/services/parking',
    );

    act(() => {
      fake.box.options?.onSelect('l:b');
    });
    expect(screen.getByRole('link', { name: 'Open page for Feature b' })).toHaveAttribute(
      'href',
      'https://example.org/x',
    );
  });

  it('navigates straight to the related page when the map is configured to link', async () => {
    const { fake } = renderMap({
      config: { interaction: 'link' },
      inputs: [
        layer('l', [point('a', 10, 51, {}, { href: '/services/parking' }), point('b', 10, 52)]),
      ],
    });
    await ready(fake);

    act(() => {
      fake.box.options?.onSelect('l:a');
    });
    expect(push).toHaveBeenCalledWith('/services/parking');

    act(() => {
      fake.box.options?.onSelect('l:b');
    });
    expect(screen.getByRole('heading', { name: 'Feature b' })).toBeInTheDocument();
  });

  it('is disabled for a map that is configured as display-only', async () => {
    const { fake } = renderMap({ config: { interaction: 'none' } });
    await ready(fake);

    expect(fake.box.options?.isSelectable).toBe(false);
    expect(screen.queryByRole('button', { name: /Show Feature a/ })).not.toBeInTheDocument();
    act(() => {
      fake.box.options?.onSelect('parking:a');
    });
    expect(
      screen.queryByRole('complementary', { name: 'Selected location' }),
    ).not.toBeInTheDocument();
  });
});

describe('the list alternative', () => {
  it('contains every location, grouped by layer, and pages long layers', () => {
    const many = Array.from({ length: 120 }, (_, i) => point(`p${i}`, 10, 50 + i / 1000));
    renderMap({ inputs: [layer('big', many, 'Big layer')] });

    expect(screen.getByRole('heading', { name: 'Big layer (120)' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Show Feature p\d+ on the map$/ })).toHaveLength(
      50,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show more locations' }));
    expect(screen.getAllByRole('button', { name: /^Show Feature p\d+ on the map$/ })).toHaveLength(
      100,
    );
  });

  it('lets keyboard users reach and activate a location', () => {
    renderMap();
    const item = screen.getByRole('button', { name: 'Show Feature a on the map' });
    item.focus();
    expect(item).toHaveFocus();
    expect(item.tagName).toBe('BUTTON');
  });
});
