import { StrictMode } from 'react';

import { render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { MapCanvas } from '@modules/map/presentation/components/map-canvas.client';
import enMap from '@modules/map/presentation/i18n/en.json';
import type {
  CreateMapRenderer,
  MapRenderer,
  RendererOptions,
} from '@modules/map/presentation/mapbox/create-mapbox-renderer';

const TILES = { accessToken: 'pk.test', styleUrl: 'mapbox://styles/mapbox/light-v11' };

/** What each created map found in its container at the moment Mapbox would have taken it over. */
interface Creation {
  readonly container: HTMLElement;
  readonly childCountAtCreation: number;
}

function recordingRenderer() {
  const creations: Creation[] = [];
  const destroyed: HTMLElement[] = [];
  const create: CreateMapRenderer = (options: RendererOptions) => {
    creations.push({
      container: options.container,
      childCountAtCreation: options.container.childNodes.length,
    });
    // Like Mapbox, take the container over: it fills it with its own canvas.
    options.container.appendChild(document.createElement('canvas'));
    const renderer: MapRenderer = {
      setLayers: vi.fn(),
      setSelected: vi.fn(),
      showBounds: vi.fn(),
      destroy: () => {
        destroyed.push(options.container);
      },
    };
    return Promise.resolve(renderer);
  };
  return { create, creations, destroyed };
}

function renderCanvas(createRenderer: CreateMapRenderer, strict: boolean) {
  const canvas = (
    <NextIntlClientProvider locale="en" messages={enMap} timeZone="UTC">
      <MapCanvas
        tiles={TILES}
        styles={[]}
        layers={[]}
        initialBounds={null}
        selectedKey={null}
        focusKey={null}
        isSelectable
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        createRenderer={createRenderer}
      />
    </NextIntlClientProvider>
  );
  return render(strict ? <StrictMode>{canvas}</StrictMode> : canvas);
}

describe('MapCanvas', () => {
  it('hands every map an empty container, as Mapbox requires', async () => {
    const fake = recordingRenderer();
    renderCanvas(fake.create, false);

    await waitFor(() => {
      expect(fake.creations).toHaveLength(1);
    });
    expect(fake.creations[0]?.childCountAtCreation).toBe(0);
  });

  it('keeps every container empty even when React starts the map twice (Strict Mode)', async () => {
    const fake = recordingRenderer();
    renderCanvas(fake.create, true);

    await waitFor(() => {
      expect(fake.creations.length).toBeGreaterThanOrEqual(2);
    });
    expect(fake.creations.map((creation) => creation.childCountAtCreation)).toEqual(
      fake.creations.map(() => 0),
    );
    // A map never shares its container with another one.
    expect(new Set(fake.creations.map((creation) => creation.container)).size).toBe(
      fake.creations.length,
    );
  });

  it('removes the map and its container when it goes away', async () => {
    const fake = recordingRenderer();
    const { unmount } = renderCanvas(fake.create, false);
    await waitFor(() => {
      expect(fake.creations).toHaveLength(1);
    });
    const container = fake.creations[0]?.container;

    unmount();

    expect(fake.destroyed).toContain(container);
    expect(container?.isConnected).toBe(false);
  });

  it('keeps the loading note outside the map container', async () => {
    const fake = recordingRenderer();
    const { getByRole } = renderCanvas(fake.create, false);

    await waitFor(() => {
      expect(fake.creations).toHaveLength(1);
    });
    expect(fake.creations[0]?.container.contains(getByRole('status'))).toBe(false);
  });
});
