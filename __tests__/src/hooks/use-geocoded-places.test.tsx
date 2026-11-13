import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGeocodedPlaces } from '@hooks/use-geocoded-places';

const { searchAddresses } = vi.hoisted(() => ({ searchAddresses: vi.fn() }));
vi.mock('@lib/geocoding', () => ({ searchAddresses }));

const options = { accessToken: 'pk.test', language: 'de' };

beforeEach(() => {
  searchAddresses.mockReset();
  window.sessionStorage.clear();
});

describe('useGeocodedPlaces', () => {
  it('finds each address once, leaves out blank and unfindable ones, and says when it is done', async () => {
    searchAddresses.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(query === 'Nirgendwo 1' ? [] : [{ id: 'x', label: query, lng: 13, lat: 52 }]),
    );
    const places = [
      { id: 'a', address: 'Alexanderplatz 1, Berlin' },
      { id: 'b', address: '   ' },
      { id: 'c', address: null },
      { id: 'd', address: 'Nirgendwo 1' },
    ];

    const { result, rerender } = renderHook(() => useGeocodedPlaces(places, options));
    await act(async () => Promise.resolve());

    expect(result.current).toEqual({ places: { a: { lng: 13, lat: 52 } }, isSettled: true });
    expect(searchAddresses).toHaveBeenCalledTimes(2);

    // The same addresses again come from the session's memory.
    rerender();
    const again = renderHook(() => useGeocodedPlaces(places, options));
    await act(async () => Promise.resolve());
    expect(searchAddresses).toHaveBeenCalledTimes(2);
    expect(again.result.current.places).toEqual({ a: { lng: 13, lat: 52 } });
  });

  it('asks nothing without a token, and leaves a place out when the request fails', async () => {
    const { result } = renderHook(() =>
      useGeocodedPlaces([{ id: 'a', address: 'Irgendwo 5' }], { ...options, accessToken: null }),
    );
    expect(searchAddresses).not.toHaveBeenCalled();
    expect(result.current.isSettled).toBe(false);

    searchAddresses.mockRejectedValue(new Error('offline'));
    const failing = renderHook(() =>
      useGeocodedPlaces([{ id: 'z', address: 'Fehlerstraße 9' }], options),
    );
    await act(async () => Promise.resolve());
    expect(failing.result.current).toEqual({ places: {}, isSettled: true });
  });

  it('works without browser storage', async () => {
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      searchAddresses.mockResolvedValue([{ id: 'x', label: 'a', lng: 1, lat: 2 }]);
      const { result } = renderHook(() =>
        useGeocodedPlaces([{ id: 'q', address: 'Speicherlos 1' }], options),
      );
      await act(async () => Promise.resolve());
      expect(result.current.places).toEqual({ q: { lng: 1, lat: 2 } });
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
