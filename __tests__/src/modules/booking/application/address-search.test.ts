import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BookingDependencies } from '@modules/booking/application/booking-dependencies';
import { SearchAddresses } from '@modules/booking/application/queries/search-addresses';
import { BOOKING_RATE_LIMITS } from '@modules/booking/application/rate-limits';
import type { AddressSearch } from '@modules/booking/domain/ports/address-search.port';
import { MapboxAddressSearch } from '@modules/booking/infrastructure/geocoding/mapbox-address-search';

import { okAsync } from '@lib/result';

import { actorWithRole } from '../support/fakes';
import { TENANT } from '../support/fixtures';
import { createWorld } from '../support/world';

function recordingSearch() {
  const requests: Array<{ query: string; language: string; limit: number }> = [];
  const search: AddressSearch = {
    search: (request) => {
      requests.push(request);
      return okAsync([{ key: 'a1', label: 'Marktplatz 1, 10115 Berlin' }]);
    },
  };
  return { search, requests };
}

const as = (role: Parameters<typeof actorWithRole>[1]) => actorWithRole(TENANT, role);

function useCase(overrides: Partial<BookingDependencies> & { role?: 'admin' | 'viewer' }) {
  const { role = 'admin', ...rest } = overrides;
  const world = createWorld({ actor: as(role) });
  return new SearchAddresses({ ...world.admin, ...rest });
}

describe('searching addresses while editing a location', () => {
  it('asks the geocoder for a trimmed query in the request language and returns the suggestions', async () => {
    const { search, requests } = recordingSearch();
    const result = await useCase({ addresses: search }).execute({
      query: '  Marktplatz 1 ',
      language: 'de',
    });

    expect(result._unsafeUnwrap()).toEqual([{ key: 'a1', label: 'Marktplatz 1, 10115 Berlin' }]);
    expect(requests).toEqual([{ query: 'Marktplatz 1', language: 'de', limit: 6 }]);
  });

  it('is for those who configure; a viewer is refused before anything is sent', async () => {
    const { search, requests } = recordingSearch();
    const result = await useCase({ role: 'viewer', addresses: search }).execute({
      query: 'Marktplatz',
      language: 'de',
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(requests).toHaveLength(0);
  });

  it('does not send a query that is too short to mean anything', async () => {
    const { search, requests } = recordingSearch();
    const result = await useCase({ addresses: search }).execute({ query: 'ab ', language: 'de' });

    expect(result._unsafeUnwrapErr().kind).toBe('validation');
    expect(requests).toHaveLength(0);
  });

  it('answers with nothing, not an error, when no geocoder is configured', async () => {
    const result = await useCase({ addresses: null }).execute({
      query: 'Marktplatz',
      language: 'de',
    });

    expect(result._unsafeUnwrap()).toEqual([]);
  });

  it('refuses an editor who has used up their budget, and stops calling the service', async () => {
    const { search, requests } = recordingSearch();
    const limited = useCase({ addresses: search });
    const { limit } = BOOKING_RATE_LIMITS.searchAddress;

    const outcomes = [];
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      outcomes.push(await limited.execute({ query: 'Marktplatz', language: 'de' }));
    }

    expect(outcomes.filter((outcome) => outcome.isOk())).toHaveLength(limit);
    expect(outcomes.at(-1)?._unsafeUnwrapErr()).toMatchObject({
      kind: 'rate_limited',
      code: 'booking.rate_limited',
    });
    expect(requests).toHaveLength(limit);
  });
});

describe('the Mapbox address search', () => {
  const FEATURES = {
    features: [
      {
        properties: {
          mapbox_id: 'dXJu1',
          name: 'Marktplatz 1',
          full_address: 'Marktplatz 1, 10115 Berlin, Deutschland',
        },
      },
      { properties: { name: 'Marktplatz', place_formatted: 'Potsdam, Deutschland' } },
    ],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const ask = (search: MapboxAddressSearch, query = 'Marktplatz') =>
    search.search({ query, language: 'de', limit: 6 });

  it('turns features into labelled suggestions, preferring the full address', async () => {
    stubFetch(Response.json(FEATURES));
    const found = (await ask(new MapboxAddressSearch('pk.test')))._unsafeUnwrap();

    expect(found.map((suggestion) => suggestion.label)).toEqual([
      'Marktplatz 1, 10115 Berlin, Deutschland',
      'Marktplatz, Potsdam, Deutschland',
    ]);
    expect(found[0]?.key).toBe('dXJu1');
  });

  it('sends the query, language and limit, with the token only as a parameter', async () => {
    const fetchMock = stubFetch(Response.json(FEATURES));
    await ask(new MapboxAddressSearch('pk.test'), 'Markt platz');

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe('https://api.mapbox.com/search/geocode/v6/forward');
    expect(url.searchParams.get('q')).toBe('Markt platz');
    expect(url.searchParams.get('language')).toBe('de');
    expect(url.searchParams.get('limit')).toBe('6');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
  });

  it('answers a repeated query from memory, once, until the cache expires', async () => {
    const fetchMock = stubFetch(Response.json(FEATURES));
    let now = 1_000;
    const search = new MapboxAddressSearch('pk.test', () => now);

    await ask(search);
    await ask(search);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 11 * 60_000;
    await ask(search);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports an unavailable service, never the provider body, when Mapbox refuses', async () => {
    stubFetch(new Response('invalid token sk.secret', { status: 401 }));
    const error = (await ask(new MapboxAddressSearch('pk.test')))._unsafeUnwrapErr();

    expect(error.kind).toBe('infrastructure');
    expect(JSON.stringify(error)).not.toContain('sk.secret');
  });

  it('refuses a response of an unexpected shape', async () => {
    stubFetch(Response.json({ features: [{ nothing: true }] }));

    expect((await ask(new MapboxAddressSearch('pk.test')))._unsafeUnwrapErr().kind).toBe(
      'infrastructure',
    );
  });

  it('does not cache a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(Response.json(FEATURES));
    vi.stubGlobal('fetch', fetchMock);
    const search = new MapboxAddressSearch('pk.test');

    expect((await ask(search)).isErr()).toBe(true);
    expect((await ask(search)).isOk()).toBe(true);
  });
});
