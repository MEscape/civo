'use client';

import { useEffect } from 'react';

import { useWatch } from 'react-hook-form';

import { CheckboxField, TextField } from '@components/shared/field';
import { FormSelectField, SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { SAVED_MAP_LIMITS } from '../../../application/contracts/saved-map-views';
import { useFieldLabel } from '../../hooks/use-field-label';

import { MapBackgroundNote } from './map-background-note';

import type { FieldProfile } from '../../../application/contracts/map-constraints';
import type { MapEditorValues } from '../../hooks/use-map-editor';
import type { UseFormReturn } from 'react-hook-form';

/** The value of the "automatic" choice: a select cannot hold an empty value. */
const AUTOMATIC = 'automatic';

interface MapAppearanceFieldsProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly errorText: (message: string | undefined) => string | undefined;
  /** The attributes the connected data offers, as the preview found them; empty without data. */
  readonly attributes: readonly FieldProfile[];
  /** Whether this installation draws Mapbox street tiles; otherwise every map is the first-party vector map. */
  readonly hasStreetTiles: boolean;
}

type PointStyle = MapEditorValues['settings']['pointStyle'];

/** A density heatmap and values-sized circles need data; a handful of own locations are markers or groups. */
const LOCATION_ONLY_STYLES: readonly PointStyle[] = ['markers', 'clusters'];
const ALL_STYLES: readonly PointStyle[] = ['markers', 'circles', 'clusters', 'heatmap'];

interface AttributeSelectProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly name: 'settings.colorBy' | 'settings.sizeBy';
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly automaticLabel: string;
  readonly fields: readonly FieldProfile[];
}

/** One attribute of the data to encode, or "automatic": a choice from what the data has, never typed. */
function AttributeSelect({
  form,
  name,
  id,
  label,
  hint,
  automaticLabel,
  fields,
}: AttributeSelectProps) {
  const labelOf = useFieldLabel();
  const chosen = useWatch({ control: form.control, name }) ?? '';
  // A saved choice the preview has not found yet stays listed, so opening the editor never drops it.
  const offered = fields.map(({ key }) => key);
  const keys = chosen === '' || offered.includes(chosen) ? offered : [...offered, chosen];
  return (
    <div className="space-y-1.5">
      <SelectField
        id={id}
        label={label}
        value={chosen === '' ? AUTOMATIC : chosen}
        onValueChange={(value) => {
          form.setValue(name, value === AUTOMATIC ? '' : value, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        options={[
          { value: AUTOMATIC, label: automaticLabel },
          ...keys.map((key) => ({ value: key, label: labelOf(key) })),
        ]}
      />
      <p className="text-xs text-copy-muted">{hint}</p>
    </div>
  );
}

/**
 * How the map looks and behaves, as little as a first map needs: how points are drawn, the map's
 * height, and whether it shows details and a legend. What selecting a point shows is decided where
 * the content is: the description and link of a location, the fields of a dataset. What only makes
 * sense for connected data (colour and size by an attribute, filters, the density limit) waits in
 * "More options", and is absent for a map of own locations.
 */
export function MapAppearanceFields({
  form,
  errorText,
  attributes,
  hasStreetTiles,
}: MapAppearanceFieldsProps) {
  const t = useTranslations('map');
  const [layers, interaction, pointStyle] = useWatch({
    control: form.control,
    name: ['settings.layers', 'settings.interaction', 'settings.pointStyle'],
  });
  const hasData = layers.length > 0;
  const styles = hasData ? ALL_STYLES : LOCATION_ONLY_STYLES;

  // Own locations only: a style that needs data would draw nothing useful, so the map falls back.
  useEffect(() => {
    if (!styles.includes(pointStyle)) {
      form.setValue('settings.pointStyle', 'markers', { shouldDirty: true });
    }
  }, [form, pointStyle, styles]);

  const colorable = attributes.filter(
    ({ type, distinct }) => type === 'number' || distinct !== null,
  );
  const sizable = attributes.filter(({ type }) => type === 'number');
  return (
    <div className="space-y-5">
      <MapBackgroundNote hasStreetTiles={hasStreetTiles} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FormSelectField
            control={form.control}
            name="settings.pointStyle"
            id="map-point-style"
            label={t('management.pointStyle')}
            errorText={errorText}
            options={styles.map((style) => ({ value: style, label: t(`management.${style}`) }))}
          />
          <p className="text-xs text-copy-muted">
            {t(
              hasStreetTiles
                ? 'management.pointStyleStreetsHint'
                : 'management.pointStyleVectorHint',
            )}
          </p>
        </div>
        <FormSelectField
          control={form.control}
          name="settings.height"
          id="map-height"
          label={t('management.height')}
          errorText={errorText}
          options={[
            { value: 'compact', label: t('management.compact') },
            { value: 'standard', label: t('management.standard') },
            { value: 'tall', label: t('management.tall') },
          ]}
        />
      </div>
      <div className="space-y-3">
        <CheckboxField
          checked={interaction !== 'none'}
          onChange={(event) => {
            form.setValue('settings.interaction', event.target.checked ? 'details' : 'none', {
              shouldDirty: true,
            });
          }}
          id="map-details"
          label={t('management.showDetails')}
          hint={t('management.showDetailsHint')}
        />
        <CheckboxField
          {...form.register('settings.showLegend')}
          id="map-legend"
          label={t('management.showLegend')}
        />
      </div>
      {hasData && (
        <details className="group rounded-token border border-border">
          <summary className="cursor-pointer rounded-token px-4 py-3 text-sm font-medium text-copy outline-none focus-visible:ring-2 focus-visible:ring-focus">
            {t('management.moreOptions')}
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <AttributeSelect
                form={form}
                name="settings.colorBy"
                id="map-color"
                label={t('management.colorBy')}
                hint={t('management.colorByHint')}
                automaticLabel={t('management.automatic')}
                fields={colorable}
              />
              {(pointStyle === 'circles' || pointStyle === 'heatmap') && (
                <AttributeSelect
                  form={form}
                  name="settings.sizeBy"
                  id="map-size"
                  label={t('management.sizeBy')}
                  hint={t('management.sizeByHint')}
                  automaticLabel={t('management.automatic')}
                  fields={sizable}
                />
              )}
            </div>
            <TextField
              {...form.register('settings.featureLimit', { valueAsNumber: true })}
              id="map-limit"
              type="number"
              min={SAVED_MAP_LIMITS.layers}
              max={SAVED_MAP_LIMITS.maxFeatures}
              label={t('management.featureLimit')}
              hint={t('management.featureLimitHint')}
              error={errorText(form.formState.errors.settings?.featureLimit?.message)}
            />
            <CheckboxField
              {...form.register('settings.showFilters')}
              id="map-filters"
              label={t('management.showFilters')}
            />
          </div>
        </details>
      )}
    </div>
  );
}
