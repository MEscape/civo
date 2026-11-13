'use client';

import { useEffect, useState } from 'react';

import { searchAddresses } from '@lib/geocoding';
import type { GeocodeHit } from '@lib/geocoding';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

interface AddressSearchOptions {
  readonly query: string;
  /** Without a token nothing is asked. */
  readonly accessToken: string | null;
  readonly language: string;
  /** Typing in a field that is not focused or open must not ask anything. */
  readonly isEnabled: boolean;
}

/**
 * Suggestions for an address while someone types: asked 250 ms after the last key, never for fewer
 * than three letters, and a newer question cancels the older one. A failed request just offers
 * nothing, so the field stays a plain text field.
 */
export function useAddressSearch({
  query,
  accessToken,
  language,
  isEnabled,
}: AddressSearchOptions) {
  const [state, setState] = useState<{
    readonly query: string;
    readonly hits: readonly GeocodeHit[];
  }>({ query: '', hits: [] });
  const text = query.trim();
  const canAsk = isEnabled && accessToken !== null && text.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!canAsk) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddresses({ query: text, accessToken, language, signal: controller.signal })
        .then((hits) => {
          setState({ query: text, hits });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState({ query: text, hits: [] });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canAsk, text, accessToken, language]);

  return {
    hits: canAsk && state.query === text ? state.hits : [],
    /** Asked, and the answer for the text now in the field has not come yet. */
    isSearching: canAsk && state.query !== text,
  };
}
