import { infrastructureError } from '@lib/errors';
import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { ResultAsync, err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { MS_PER_MINUTE, arrayOf, isString, objectOf, optional } from '@lib/utils';

import { BOOKING_ERROR_CODES } from '../../domain/errors/booking-errors';

import type { AddressSearch, AddressSuggestion } from '../../domain/ports/address-search.port';

const GEOCODING_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const REQUEST_TIMEOUT_MS = 4000;
const CACHE_MINUTES = 10;
const CACHE_TTL_MS = CACHE_MINUTES * MS_PER_MINUTE;
const CACHE_MAX_ENTRIES = 300;

interface MapboxFeature {
  readonly properties: {
    readonly mapbox_id?: string | undefined;
    readonly name: string;
    readonly full_address?: string | undefined;
    readonly place_formatted?: string | undefined;
  };
}

const isFeature = objectOf<MapboxFeature>({
  properties: objectOf<MapboxFeature['properties']>({
    mapbox_id: optional(isString),
    name: isString,
    full_address: optional(isString),
    place_formatted: optional(isString),
  }),
});

const isResponse = objectOf<{ readonly features: MapboxFeature[] }>({
  features: arrayOf(isFeature),
});

function toSuggestion(feature: MapboxFeature, position: number): AddressSuggestion {
  const properties = feature.properties;
  const label =
    properties.full_address ??
    [properties.name, properties.place_formatted].filter((part) => part !== undefined).join(', ');
  return { key: properties.mapbox_id ?? `${position}:${label}`, label };
}

function failed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    BOOKING_ERROR_CODES.persistenceFailed,
    'The address search is not available.',
    cause,
  );
}

interface CacheEntry {
  readonly at: number;
  readonly suggestions: readonly AddressSuggestion[];
}

/**
 * Address suggestions from the Mapbox geocoding API, asked from the server so
 * the token never reaches the browser and the request can be limited and
 * cached. Results are public geodata, identical for every tenant, so the
 * small in-process cache (keyed by query, language and limit only) cannot
 * leak anything between websites; it exists to spare the API repeated
 * keystrokes and double clicks, and expires after ten minutes.
 */
export class MapboxAddressSearch implements AddressSearch {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly token: string,
    private readonly now: () => number = Date.now,
  ) {}

  search(request: {
    readonly query: string;
    readonly language: string;
    readonly limit: number;
  }): ResultAsync<readonly AddressSuggestion[], InfrastructureAppError> {
    const key = `${request.language}|${request.limit}|${request.query.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && this.now() - cached.at < CACHE_TTL_MS) {
      return ResultAsync.fromSafePromise(Promise.resolve(cached.suggestions));
    }
    return new ResultAsync(this.fetchSuggestions(request)).map((suggestions) => {
      this.remember(key, suggestions);
      return suggestions;
    });
  }

  private async fetchSuggestions(request: {
    readonly query: string;
    readonly language: string;
    readonly limit: number;
  }): Promise<AppResult<readonly AddressSuggestion[], InfrastructureAppError>> {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('q', request.query);
    url.searchParams.set('language', request.language);
    url.searchParams.set('limit', String(request.limit));
    url.searchParams.set('types', 'address,street,place,postcode');
    url.searchParams.set('autocomplete', 'true');
    // Mapbox takes the token as a query parameter. The URL is never logged, only the status.
    url.searchParams.set('access_token', this.token);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        logger.warn('booking.address_search_rejected', { status: response.status });
        return err(failed(`HTTP ${response.status}`));
      }
      const body: unknown = await response.json();
      if (!isResponse(body)) {
        logger.warn('booking.address_search_unexpected_shape');
        return err(failed('unexpected response shape'));
      }
      return ok(body.features.map(toSuggestion));
    } catch (cause) {
      logger.warn('booking.address_search_failed', { cause: String(cause) });
      return err(failed(cause));
    }
  }

  private remember(key: string, suggestions: readonly AddressSuggestion[]): void {
    this.cache.delete(key);
    this.cache.set(key, { at: this.now(), suggestions });
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) {
        return;
      }
      this.cache.delete(oldest.value);
    }
  }
}
