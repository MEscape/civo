import { z } from 'zod';

import { buildQueryString } from '@lib/utils';

const FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const DEFAULT_LIMIT = 5;
/** What a person types an address for: not countries, regions or points of interest. */
const PLACE_TYPES = 'address,street,postcode,locality,place';

/** A place the geocoder found, ready to pin on a map. */
export interface GeocodeHit {
  readonly id: string;
  /** The place as one line, the way a person writes it on an envelope. */
  readonly label: string;
  readonly lng: number;
  readonly lat: number;
}

export interface GeocodeRequest {
  readonly query: string;
  /** A Mapbox PUBLIC token. */
  readonly accessToken: string;
  /** The language of the labels (`de`, `en`). */
  readonly language: string;
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

const responseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        mapbox_id: z.string(),
        name: z.string(),
        full_address: z.string().optional(),
        place_formatted: z.string().optional(),
      }),
    }),
  ),
});

/**
 * Finds places by their written address through Mapbox's forward geocoding, for showing them on a
 * Mapbox map (temporary results: they are drawn, never stored). Empty text finds nothing without
 * asking. A refusal or a failed request throws; an answer of an unknown shape finds nothing.
 */
export async function searchAddresses(
  { query, accessToken, language, limit = DEFAULT_LIMIT, signal }: GeocodeRequest,
  fetcher: typeof fetch = fetch,
): Promise<readonly GeocodeHit[]> {
  const text = query.trim();
  if (text === '') {
    return [];
  }
  const search = buildQueryString({
    q: text,
    access_token: accessToken,
    language,
    limit,
    types: PLACE_TYPES,
    autocomplete: true,
  });
  const response = await fetcher(`${FORWARD_URL}${search}`, {
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    throw new Error(`geocoding.failed.${response.status}`);
  }
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return [];
  }
  return parsed.data.features.map(({ geometry, properties }) => ({
    id: properties.mapbox_id,
    label:
      properties.full_address ??
      [properties.name, properties.place_formatted].filter(Boolean).join(', '),
    lng: geometry.coordinates[0],
    lat: geometry.coordinates[1],
  }));
}
