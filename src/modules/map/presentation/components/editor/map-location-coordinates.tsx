'use client';

import { TextField } from '@components/shared/field';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { fieldPath } from '@lib/errors';

import type { MapEditorValues } from '../../schemas/saved-map-schema';
import type { UseFormReturn } from 'react-hook-form';

interface MapLocationCoordinatesProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly index: number;
  readonly fieldKey: string;
  readonly errorText: (message: string | undefined) => string | undefined;
  /** Without an address search the coordinates are the only way to place a location. */
  readonly isEditable: boolean;
}

/**
 * Where a location sits. Found by address, the coordinates are only shown; typed in only when no
 * address search is configured for this installation.
 */
export function MapLocationCoordinates({
  form,
  index,
  fieldKey,
  errorText,
  isEditable,
}: MapLocationCoordinatesProps) {
  const t = useTranslations('map');
  const format = useAppFormatters();
  if (!isEditable) {
    const latitude = form.getValues(fieldPath('settings', 'locations', index, 'latitude'));
    const longitude = form.getValues(fieldPath('settings', 'locations', index, 'longitude'));
    if (latitude === undefined || longitude === undefined) {
      return null;
    }
    return (
      <p className="text-xs text-copy-muted tabular-nums">
        {t('management.coordinates', {
          latitude: format.number(latitude, { maximumFractionDigits: 5 }),
          longitude: format.number(longitude, { maximumFractionDigits: 5 }),
        })}
      </p>
    );
  }
  const errors = form.formState.errors.settings?.locations?.[index];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        {...form.register(fieldPath('settings', 'locations', index, 'longitude'), {
          valueAsNumber: true,
        })}
        id={`location-longitude-${fieldKey}`}
        type="number"
        step="any"
        min={-180}
        max={180}
        label={t('management.longitude')}
        error={errorText(errors?.longitude?.message)}
      />
      <TextField
        {...form.register(fieldPath('settings', 'locations', index, 'latitude'), {
          valueAsNumber: true,
        })}
        id={`location-latitude-${fieldKey}`}
        type="number"
        step="any"
        min={-90}
        max={90}
        label={t('management.latitude')}
        error={errorText(errors?.latitude?.message)}
      />
    </div>
  );
}
