import { describe, expect, it, vi } from 'vitest';

import { searchAddresses } from '@lib/geocoding';

const answer = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });

const request = { query: ' Rathausplatz 1 ', accessToken: 'pk.test', language: 'de' };

describe('searching addresses', () => {
  it('finds nothing, without asking, for empty text', async () => {
    const fetcher = answer({});

    expect(await searchAddresses({ ...request, query: '   ' }, fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks Mapbox for the trimmed text in the language and maps what it finds', async () => {
    const fetcher = answer({
      features: [
        {
          geometry: { coordinates: [13.4, 52.5] },
          properties: {
            mapbox_id: 'a',
            name: 'Rathausplatz 1',
            full_address: 'Rathausplatz 1, 10178 Berlin',
          },
        },
        {
          geometry: { coordinates: [13.5, 52.6] },
          properties: { mapbox_id: 'b', name: 'Rathausplatz 10', place_formatted: '10179 Berlin' },
        },
        {
          geometry: { coordinates: [1, 2] },
          properties: { mapbox_id: 'c', name: 'Nur Name' },
        },
      ],
    });
    const controller = new AbortController();

    const hits = await searchAddresses(
      { ...request, limit: 3, signal: controller.signal },
      fetcher,
    );

    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get('q')).toBe('Rathausplatz 1');
    expect(params.get('language')).toBe('de');
    expect(params.get('limit')).toBe('3');
    expect(params.get('access_token')).toBe('pk.test');
    expect(options.signal).toBe(controller.signal);
    expect(hits).toEqual([
      { id: 'a', label: 'Rathausplatz 1, 10178 Berlin', lng: 13.4, lat: 52.5 },
      { id: 'b', label: 'Rathausplatz 10, 10179 Berlin', lng: 13.5, lat: 52.6 },
      { id: 'c', label: 'Nur Name', lng: 1, lat: 2 },
    ]);
  });

  it('uses the global fetch and the default limit when none is given', async () => {
    const original = globalThis.fetch;
    const fetcher = answer({ features: [] });
    globalThis.fetch = fetcher;
    try {
      expect(await searchAddresses(request)).toEqual([]);
      expect(new URL(fetcher.mock.calls[0]?.[0] as string).searchParams.get('limit')).toBe('5');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('throws when Mapbox refuses and finds nothing in an answer of an unknown shape', async () => {
    await expect(searchAddresses(request, answer({}, 401))).rejects.toThrow('geocoding.failed.401');
    expect(await searchAddresses(request, answer({ unexpected: true }))).toEqual([]);
  });
});
