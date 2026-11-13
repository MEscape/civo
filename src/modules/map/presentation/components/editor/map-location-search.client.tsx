'use client';

import { useState } from 'react';

import { AutocompleteField } from '@components/shared/select-field';

import { useAddressSearch } from '@hooks/use-address-search';

import { useLocale, useTranslations } from '@i18n/client';

interface MapLocationSearchProps {
  readonly id: string;
  /** The map tiles' token, which also finds addresses. */
  readonly accessToken: string;
  readonly disabled?: boolean | undefined;
  readonly onPick: (place: {
    readonly label: string;
    readonly lng: number;
    readonly lat: number;
  }) => void;
}

/**
 * Finds a place by its address, the way a booking location is found, and hands it over as a new
 * location: nobody should have to look up a town hall's longitude. The text is only a search; it
 * is cleared once a place was picked, ready for the next one.
 */
export function MapLocationSearch({ id, accessToken, disabled, onPick }: MapLocationSearchProps) {
  const t = useTranslations('map');
  const app = useTranslations('app');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const { hits, isSearching } = useAddressSearch({
    query,
    accessToken,
    language: locale,
    isEnabled: true,
  });
  return (
    <AutocompleteField
      id={id}
      label={t('management.searchAddress')}
      hint={t('management.searchAddressHint')}
      value={query}
      onValueChange={setQuery}
      onPick={(option) => {
        const hit = hits.find((candidate) => candidate.label === option.value);
        if (hit !== undefined) {
          onPick(hit);
          setQuery('');
        }
      }}
      options={hits.map((hit) => ({ value: hit.label }))}
      isSearching={isSearching}
      searchingLabel={app('autocomplete.searching')}
      // The browser's own address book would cover these suggestions.
      autoComplete="off"
      disabled={disabled}
    />
  );
}
