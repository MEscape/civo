'use client';

import { ComboboxField } from '@components/shared/combobox-field';

import { useTranslations } from '@i18n/client';

import { useAddressSuggestions } from '../../hooks/use-address-suggestions';

export interface AddressFieldProps {
  readonly id: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (address: string) => void;
}

/**
 * The address of a location: suggestions while typing, picked with mouse or
 * keyboard, and the typed text always accepted as it is. An address nobody
 * has heard of (a new building, a meeting point) must stay enterable, so the
 * search only ever suggests.
 */
export function AddressField({ id, value, error, onChange }: AddressFieldProps) {
  const t = useTranslations('booking');
  const { suggestions, status, search } = useAddressSuggestions();
  const known = suggestions.map((suggestion) => ({
    value: suggestion.label,
    label: suggestion.label,
  }));
  const emptyText =
    status === 'failed' ? t('locations.addressUnavailable') : t('locations.addressNone');

  return (
    <ComboboxField
      selectionMode="single"
      id={id}
      label={t('locations.address')}
      hint={t('locations.addressHint')}
      placeholder={t('locations.addressPlaceholder')}
      error={error}
      options={known}
      value={value}
      emptyText={emptyText}
      loadingText={status === 'searching' ? t('locations.addressSearching') : undefined}
      createText={(typed) => t('locations.addressUseTyped', { value: typed })}
      commitOnBlur
      onQueryChange={search}
      onValueChange={onChange}
    />
  );
}
