import { useEffect, useRef, useState } from 'react';

import { debounce } from '@lib/utils';

import { searchAddressesAction } from '../actions/search-addresses-action';

import type { AddressSuggestionDto } from '../dto/setup-dto';

/** Fewer letters than this match too much to be worth a paid request. */
const MIN_QUERY_LENGTH = 3;
const SEARCH_DELAY_MS = 300;

export type AddressSearchStatus = 'idle' | 'searching' | 'done' | 'failed';

export interface AddressSuggestions {
  readonly suggestions: readonly AddressSuggestionDto[];
  readonly status: AddressSearchStatus;
  /** Report what the person has typed; the search runs once they pause. */
  readonly search: (query: string) => void;
}

/**
 * Address suggestions for a field being typed in. The server decides who may
 * ask and how often, so this only shapes the traffic: it waits for a pause in
 * typing (the shared `debounce`), skips queries too short to mean anything,
 * and drops the answer to a query that is no longer the latest, so a slow
 * early answer can never replace a newer one.
 */
export function useAddressSuggestions(): AddressSuggestions {
  const [suggestions, setSuggestions] = useState<readonly AddressSuggestionDto[]>([]);
  const [status, setStatus] = useState<AddressSearchStatus>('idle');
  const latest = useRef(0);
  const [debouncedSearch] = useState(() =>
    debounce((query: string, ticket: number) => {
      void searchAddressesAction({ query }).then((result) => {
        if (ticket !== latest.current) {
          return;
        }
        setSuggestions(result.ok ? result.data : []);
        setStatus(result.ok ? 'done' : 'failed');
      });
    }, SEARCH_DELAY_MS),
  );

  useEffect(
    () => () => {
      latest.current += 1;
      debouncedSearch.cancel();
    },
    [debouncedSearch],
  );

  function search(query: string) {
    latest.current += 1;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      debouncedSearch.cancel();
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    setStatus('searching');
    debouncedSearch(trimmed, latest.current);
  }

  return { suggestions, status, search };
}
