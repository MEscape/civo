'use client';

import { useEffect, useState } from 'react';

import { searchAddresses } from '@lib/geocoding';

export interface PlaceToLocate {
  readonly id: string;
  /** The written address; `null` or blank places nothing. */
  readonly address: string | null;
}

export interface LocatedPlace {
  readonly lng: number;
  readonly lat: number;
}

const STORAGE_PREFIX = 'geocode:';
const memory = new Map<string, LocatedPlace | null>();

function readCached(key: string): LocatedPlace | null | undefined {
  if (memory.has(key)) {
    return memory.get(key);
  }
  try {
    const stored = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (stored !== null) {
      const value = JSON.parse(stored) as LocatedPlace | null;
      memory.set(key, value);
      return value;
    }
  } catch {
    // Storage can be blocked or full: the answer is just asked again next time.
  }
  return undefined;
}

function remember(key: string, value: LocatedPlace | null): void {
  memory.set(key, value);
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // See `readCached`.
  }
}

/**
 * Where written addresses are, for pins on a map. Each address is asked once per browser session
 * (Mapbox's temporary results may be drawn on a Mapbox map but not kept in our database), so a list
 * that is paged or filtered does not ask again. Places come in as they are found; one that cannot
 * be found (a typo, no token) is left out and the map draws the rest.
 */
export function useGeocodedPlaces(
  places: readonly PlaceToLocate[],
  options: { readonly accessToken: string | null; readonly language: string },
): {
  readonly places: Readonly<Record<string, LocatedPlace>>;
  /** Every address has been asked about (or answered from the session's memory). */
  readonly isSettled: boolean;
} {
  const [state, setState] = useState<{
    readonly places: Readonly<Record<string, LocatedPlace>>;
    readonly isSettled: boolean;
  }>({ places: {}, isSettled: false });
  const { accessToken, language } = options;
  const signature = JSON.stringify(places.map(({ id, address }) => [id, address]));

  useEffect(() => {
    if (accessToken === null) {
      return;
    }
    const controller = new AbortController();
    const wanted = JSON.parse(signature) as ReadonlyArray<readonly [string, string | null]>;
    const next: Record<string, LocatedPlace> = {};
    let outstanding = 0;
    const settle = () => {
      if (!controller.signal.aborted) {
        setState({ places: { ...next }, isSettled: outstanding === 0 });
      }
    };
    for (const [id, address] of wanted) {
      const text = address?.trim() ?? '';
      if (text === '') {
        continue;
      }
      const key = `${language}:${text.toLowerCase()}`;
      const cached = readCached(key);
      if (cached !== undefined) {
        if (cached !== null) {
          next[id] = cached;
        }
        continue;
      }
      outstanding += 1;
      searchAddresses({ query: text, accessToken, language, limit: 1, signal: controller.signal })
        .then(([hit]) => {
          const place = hit === undefined ? null : { lng: hit.lng, lat: hit.lat };
          remember(key, place);
          if (place !== null) {
            next[id] = place;
          }
        })
        .catch(() => undefined)
        .finally(() => {
          outstanding -= 1;
          settle();
        });
    }
    settle();
    return () => {
      controller.abort();
    };
  }, [signature, accessToken, language]);

  return state;
}
