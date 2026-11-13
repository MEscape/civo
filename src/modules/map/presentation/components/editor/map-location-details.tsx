'use client';

import { TextField, TextareaField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { fieldPath } from '@lib/errors';

import { SAVED_MAP_LIMITS } from '../../../application/contracts/saved-map-views';

import type { MapEditorValues } from '../../schemas/saved-map-schema';
import type { UseFormReturn } from 'react-hook-form';

interface MapLocationDetailsProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly index: number;
  readonly fieldKey: string;
  readonly errorText: (message: string | undefined) => string | undefined;
}

/**
 * What a visitor gets when selecting a location: an optional description and an optional link.
 * Folded away until used, so a plain location stays one name and one place.
 */
export function MapLocationDetails({ form, index, fieldKey, errorText }: MapLocationDetailsProps) {
  const t = useTranslations('map');
  const errors = form.formState.errors.settings?.locations?.[index];
  const hasValues =
    (form.getValues(fieldPath('settings', 'locations', index, 'description')) ?? '') !== '' ||
    (form.getValues(fieldPath('settings', 'locations', index, 'href')) ?? '') !== '';
  return (
    <details className="group" open={hasValues}>
      <summary className="cursor-pointer rounded-token-sm text-sm font-medium text-primary-copy outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {t('management.locationDetails')}
      </summary>
      <div className="mt-3 space-y-3">
        <TextareaField
          {...form.register(fieldPath('settings', 'locations', index, 'description'))}
          id={`location-description-${fieldKey}`}
          label={t('management.locationDescription')}
          hint={t('management.locationDescriptionHint')}
          maxLength={SAVED_MAP_LIMITS.locationDescription}
          rows={3}
          error={errorText(errors?.description?.message)}
        />
        <TextField
          {...form.register(fieldPath('settings', 'locations', index, 'href'))}
          id={`location-link-${fieldKey}`}
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t('management.locationLink')}
          hint={t('management.locationLinkHint')}
          maxLength={SAVED_MAP_LIMITS.locationHref}
          error={errors?.href?.message === undefined ? undefined : t('management.linkInvalid')}
        />
      </div>
    </details>
  );
}
