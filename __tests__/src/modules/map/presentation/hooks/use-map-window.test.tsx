import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bounds } from '@modules/map/application/contracts/map-constraints';
import type { MapModel } from '@modules/map/application/contracts/map-views';
import { useMapWindow } from '@modules/map/presentation/hooks/use-map-window';
import type { LoadMapWindow } from '@modules/map/presentation/hooks/use-map-window';

import type { ActionResult } from '@lib/result';

const FIRST_BOUNDS: Bounds = [10, 40, 20, 50];
const SECOND_BOUNDS: Bounds = [20, 40, 30, 50];
const PADDED_SECOND_BOUNDS: Bounds = [18.5, 38.5, 31.5, 51.5];
const DEBOUNCE_MS = 250;

function mapModel(label: string): MapModel {
  return {
    layers: [
      {
        id: label,
        label,
        features: [
          {
            key: `${label}:location`,
            label,
            geometry: { type: 'Point', coordinates: [15, 45] },
            family: 'point',
            attributes: {},
          },
        ],
        fields: [],
        bounds: [15, 45, 15, 45],
      },
    ],
    styles: [],
    filters: [],
    bounds: null,
    featureCount: 1,
    issues: { received: 1, dropped: 0, byReason: {} },
  };
}

const INITIAL_MODEL = mapModel('Initial area');
const LATEST_MODEL = mapModel('Latest area');
const EMPTY_MODEL: MapModel = {
  ...INITIAL_MODEL,
  layers: [],
  featureCount: 0,
  issues: { received: 0, dropped: 0, byReason: {} },
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A promise settled from outside, for a response the test releases by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useMapWindow', () => {
  it('keeps existing data during movement and loads only the latest padded viewport after debounce', async () => {
    const load = vi.fn<LoadMapWindow>().mockResolvedValue({ ok: true, data: LATEST_MODEL });
    const onBoundsChange = vi.fn();
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load, onBoundsChange));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1));
    expect(load).not.toHaveBeenCalled();
    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(result.current.state).toBe('loading');

    act(() => {
      result.current.handleViewportChange(SECOND_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1));
    expect(load).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(load.mock.calls).toEqual([[PADDED_SECOND_BOUNDS]]);
    expect(onBoundsChange).toHaveBeenLastCalledWith(SECOND_BOUNDS);
    expect(result.current.model).toBe(LATEST_MODEL);
    expect(result.current.state).toBe('idle');
  });

  it('ignores an old response as soon as a newer viewport starts its debounce', async () => {
    const first = deferred<ActionResult<MapModel>>();
    const second = deferred<ActionResult<MapModel>>();
    const load = vi
      .fn<LoadMapWindow>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    act(() => {
      result.current.handleViewportChange(SECOND_BOUNDS);
    });
    await act(async () => {
      first.resolve({ ok: true, data: mapModel('Stale area') });
    });

    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(result.current.state).toBe('loading');
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    await act(async () => {
      second.resolve({ ok: true, data: LATEST_MODEL });
    });
    expect(result.current.model).toBe(LATEST_MODEL);
    expect(result.current.state).toBe('idle');
  });

  it('accepts an empty viewport batch instead of retaining locations from the previous area', async () => {
    const load = vi.fn<LoadMapWindow>().mockResolvedValue({ ok: true, data: EMPTY_MODEL });
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));

    expect(result.current.model.layers).toEqual([]);
    expect(result.current.model.featureCount).toBe(0);
    expect(result.current.state).toBe('idle');
  });

  it('preserves the previous model on an action failure and retries the latest viewport', async () => {
    const load = vi
      .fn<LoadMapWindow>()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'map.source_failed', message: 'Unavailable' },
      })
      .mockResolvedValueOnce({ ok: true, data: LATEST_MODEL });
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    act(() => {
      result.current.handleViewportChange(SECOND_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(result.current.state).toBe('failed');

    act(() => {
      result.current.retry();
    });
    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(result.current.state).toBe('loading');
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(load.mock.calls).toEqual([[PADDED_SECOND_BOUNDS], [PADDED_SECOND_BOUNDS]]);
    expect(result.current.model).toBe(LATEST_MODEL);
    expect(result.current.state).toBe('idle');
  });

  it('retains the displayed model when a refresh rejects unexpectedly', async () => {
    const load = vi.fn<LoadMapWindow>().mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));

    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(result.current.state).toBe('failed');
  });

  it('cancels a pending viewport read when unmounted before debounce expires', async () => {
    const load = vi.fn<LoadMapWindow>().mockResolvedValue({ ok: true, data: LATEST_MODEL });
    const { result, unmount } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));

    expect(load).not.toHaveBeenCalled();
    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not apply an in-flight response after unmount', async () => {
    const response = deferred<ActionResult<MapModel>>();
    const load: LoadMapWindow = () => response.promise;
    const observed: MapModel[] = [];
    const { result, unmount } = renderHook(() => {
      const window = useMapWindow(INITIAL_MODEL, load);
      observed.push(window.model);
      return window;
    });

    act(() => {
      result.current.handleViewportChange(FIRST_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    unmount();
    await act(async () => {
      response.resolve({ ok: true, data: LATEST_MODEL });
    });

    expect(observed.every((model) => model === INITIAL_MODEL)).toBe(true);
    expect(result.current.model).toBe(INITIAL_MODEL);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('asks again only when the view leaves the loaded area or the batch was cut short', async () => {
    const complete = { ...LATEST_MODEL, isTruncated: false };
    const load = vi.fn<LoadMapWindow>().mockResolvedValue({ ok: true, data: complete });
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(SECOND_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(load).toHaveBeenCalledTimes(1);

    // Zoomed in, and moved a little within the padding: all of it is there already.
    act(() => {
      result.current.handleViewportChange([22, 42, 28, 48]);
    });
    act(() => {
      result.current.handleViewportChange([19, 39, 29, 49]);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2));
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('idle');

    // Zoomed out past the loaded area: the new, padded area replaces the batch.
    act(() => {
      result.current.handleViewportChange([0, 30, 40, 60]);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(expect.arrayContaining([-6, 46]));
  });

  it('asks again inside the loaded area when the batch was cut short, so zooming in shows more', async () => {
    const cut = { ...LATEST_MODEL, isTruncated: true };
    const load = vi.fn<LoadMapWindow>().mockResolvedValue({ ok: true, data: cut });
    const { result } = renderHook(() => useMapWindow(INITIAL_MODEL, load));

    act(() => {
      result.current.handleViewportChange(SECOND_BOUNDS);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    act(() => {
      result.current.handleViewportChange([22, 42, 28, 48]);
    });
    await act(async () => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));

    expect(load).toHaveBeenCalledTimes(2);
  });
});
