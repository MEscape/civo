import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAddressSearch } from '@hooks/use-address-search';

const { searchAddresses } = vi.hoisted(() => ({ searchAddresses: vi.fn() }));
vi.mock('@lib/geocoding', () => ({ searchAddresses }));

const HIT = { id: 'a', label: 'Rathausplatz 1, 10178 Berlin', lng: 13.4, lat: 52.5 };
const options = (query: string, overrides = {}) => ({
  query,
  accessToken: 'pk.test',
  language: 'de',
  isEnabled: true,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  searchAddresses.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useAddressSearch', () => {
  it('asks once, 250 ms after the last key, and answers for the text now in the field', async () => {
    searchAddresses.mockResolvedValue([HIT]);
    const { result, rerender } = renderHook((props) => useAddressSearch(props), {
      initialProps: options('Rat'),
    });
    expect(result.current).toEqual({ hits: [], isSearching: true });

    rerender(options('Rath'));
    await act(async () => vi.advanceTimersByTime(250));

    expect(searchAddresses).toHaveBeenCalledTimes(1);
    expect(searchAddresses.mock.calls[0]?.[0]).toMatchObject({ query: 'Rath', language: 'de' });
    expect(result.current).toEqual({ hits: [HIT], isSearching: false });

    rerender(options('Rathaus'));
    expect(result.current).toEqual({ hits: [], isSearching: true });
  });

  it.each([
    ['too short a text', options('Ra')],
    ['no token', options('Rathaus', { accessToken: null })],
    ['a disabled field', options('Rathaus', { isEnabled: false })],
  ])('asks nothing for %s', async (_name, props) => {
    const { result } = renderHook(() => useAddressSearch(props));
    await act(async () => vi.advanceTimersByTime(1000));

    expect(searchAddresses).not.toHaveBeenCalled();
    expect(result.current).toEqual({ hits: [], isSearching: false });
  });

  it('offers nothing when the request fails, and ignores a cancelled one', async () => {
    searchAddresses.mockRejectedValue(new Error('offline'));
    const { result, unmount } = renderHook(() => useAddressSearch(options('Rathaus')));
    await act(async () => vi.advanceTimersByTime(250));
    expect(result.current).toEqual({ hits: [], isSearching: false });

    searchAddresses.mockImplementation(() => new Promise(() => undefined));
    const second = renderHook(() => useAddressSearch(options('Berlin')));
    await act(async () => vi.advanceTimersByTime(250));
    second.unmount();
    unmount();
  });
});
