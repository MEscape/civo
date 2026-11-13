'use client';

import { useFieldArray } from 'react-hook-form';

import { Trash2 } from '@components/icons/icons';
import { FieldMessage, TextField } from '@components/shared/field';
import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { fieldPath } from '@lib/errors';

import { SAVED_MAP_LIMITS } from '../../../application/contracts/saved-map-views';
import { fitStartAreaToLocations } from '../../forms/fit-start-area';

import { MapLocationCoordinates } from './map-location-coordinates';
import { MapLocationDetails } from './map-location-details';
import { MapLocationSearch } from './map-location-search.client';

import type { MapEditorValues } from '../../schemas/saved-map-schema';
import type { UseFormReturn } from 'react-hook-form';

interface MapLocationsEditorProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly errorText: (message: string | undefined) => string | undefined;
  /** The map tiles' token, which also finds addresses; `null` leaves only typed coordinates. */
  readonly accessToken: string | null;
}

/**
 * The map's own locations. A location is added by finding its address: the place's name and
 * coordinates come from the pick, and the start area moves to show every location. Only without an
 * address search are coordinates typed in, and then the location starts at the start area's middle.
 */
export function MapLocationsEditor({ form, errorText, accessToken }: MapLocationsEditorProps) {
  const t = useTranslations('map');
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'settings.locations',
    keyName: 'fieldKey',
  });
  const isFull = fields.length >= SAVED_MAP_LIMITS.locations;
  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('management.locationsHint')}</p>
      {accessToken === null ? (
        <Alert variant="info" role="status">
          {t('management.searchUnavailable')}
        </Alert>
      ) : (
        <MapLocationSearch
          id="map-location-search"
          accessToken={accessToken}
          disabled={isFull}
          onPick={(hit) => {
            // The place's own name, without the street and town that follow it.
            const name = (hit.label.split(',')[0] ?? hit.label).trim() || hit.label;
            append(
              {
                id: crypto.randomUUID(),
                label: name.slice(0, SAVED_MAP_LIMITS.label),
                longitude: hit.lng,
                latitude: hit.lat,
              },
              { shouldFocus: false },
            );
            fitStartAreaToLocations(form);
          }}
        />
      )}
      {fields.map((field, index) => (
        <fieldset
          key={field.fieldKey}
          className="space-y-3 rounded-token border border-border bg-canvas p-4"
        >
          <legend className="px-1 text-sm font-semibold text-copy">
            {t('management.locationNumber', { number: index + 1 })}
          </legend>
          <TextField
            {...form.register(fieldPath('settings', 'locations', index, 'label'))}
            id={`location-label-${field.id}`}
            label={t('management.locationName')}
            maxLength={SAVED_MAP_LIMITS.label}
            error={errorText(form.formState.errors.settings?.locations?.[index]?.label?.message)}
          />
          <MapLocationCoordinates
            form={form}
            index={index}
            fieldKey={field.id}
            errorText={errorText}
            isEditable={accessToken === null}
          />
          <MapLocationDetails form={form} index={index} fieldKey={field.id} errorText={errorText} />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive-ghost"
              size="sm"
              onClick={() => {
                remove(index);
                fitStartAreaToLocations(form);
              }}
              aria-label={t('management.removeLocationNumber', { number: index + 1 })}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('management.removeLocation')}
            </Button>
          </div>
        </fieldset>
      ))}
      <FieldMessage
        id="map-locations-error"
        message={errorText(
          form.formState.errors.settings?.locations?.message ??
            form.formState.errors.settings?.locations?.root?.message,
        )}
      />
      {accessToken === null && (
        <Button
          type="button"
          variant="outline"
          disabled={isFull}
          onClick={() => {
            const [west, south, east, north] = form.getValues('settings.initialBounds');
            append({
              id: crypto.randomUUID(),
              label: '',
              longitude: (west + east) / 2,
              latitude: (south + north) / 2,
            });
          }}
        >
          {t('management.addLocationManually')}
        </Button>
      )}
    </div>
  );
}
