'use client';

import { useFieldArray } from 'react-hook-form';

import { TextField, FieldMessage } from '@components/shared/field';
import { FormSelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { fieldPath } from '@lib/errors';

import { SAVED_MAP_LIMITS } from '../../../application/contracts/saved-map-views';

import type { MapEditorValues } from '../../hooks/use-map-editor';
import type { UseFormReturn } from 'react-hook-form';

interface MapLayersEditorProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly datasets: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly errorText: (message: string | undefined) => string | undefined;
}

export function MapLayersEditor({ form, datasets, errorText }: MapLayersEditorProps) {
  const t = useTranslations('map');
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'settings.layers',
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('management.layersDescription')}</p>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid items-end gap-3 rounded-token border border-border bg-canvas p-4 sm:grid-cols-2"
        >
          <FormSelectField
            control={form.control}
            name={fieldPath('settings', 'layers', index, 'datasetId')}
            id={`layer-dataset-${field.id}`}
            label={t('management.dataset')}
            errorText={errorText}
            placeholder={t('management.chooseDataset')}
            options={datasets.map((dataset) => ({ value: dataset.id, label: dataset.name }))}
          />
          <TextField
            {...form.register(fieldPath('settings', 'layers', index, 'label'))}
            id={`layer-label-${field.id}`}
            label={t('management.layerLabel')}
            maxLength={SAVED_MAP_LIMITS.label}
            error={errorText(form.formState.errors.settings?.layers?.[index]?.label?.message)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              remove(index);
            }}
            aria-label={t('management.removeLayerNumber', { number: index + 1 })}
          >
            {t('management.removeLayer')}
          </Button>
        </div>
      ))}
      <FieldMessage
        id="map-layers-error"
        message={errorText(
          form.formState.errors.settings?.layers?.message ??
            form.formState.errors.settings?.layers?.root?.message,
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={fields.length >= SAVED_MAP_LIMITS.layers || datasets.length === 0}
        onClick={() => {
          append({ datasetId: '', label: '' });
        }}
      >
        {t('management.addLayer')}
      </Button>
      {datasets.length === 0 && (
        <p role="status" className="text-sm text-copy-muted">
          {t('management.noDatasets')}
        </p>
      )}
    </div>
  );
}
