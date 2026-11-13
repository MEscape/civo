'use client';

import { useState } from 'react';

import { useWatch } from 'react-hook-form';

import { TextField } from '@components/shared/field';
import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { AREA_MODES, AREA_PRESETS, areaModeOf } from '../../forms/area-presets';

import type { AreaMode } from '../../forms/area-presets';
import type { RestSourceForm } from '../../schemas/rest-source-form-schema';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';

interface DataSourceAreaFieldsProps {
  readonly idPrefix: string;
  readonly control: Control<RestSourceForm>;
  readonly register: UseFormRegister<RestSourceForm>;
  readonly setValue: UseFormSetValue<RestSourceForm>;
  readonly errors: FieldErrors<RestSourceForm>;
  /** Turns a field's error code into translated text. */
  readonly errorText: (code: string | undefined) => string | undefined;
}

/**
 * How the API is asked for the part of the world a map shows. APIs word it differently, so the
 * well-known ones are presets that fill the two fields, and anything else is typed. Optional: a
 * source that cannot be asked is read whole and the area is cut out afterwards.
 */
export function DataSourceAreaFields({
  idPrefix,
  control,
  register,
  setValue,
  errors,
  errorText,
}: DataSourceAreaFieldsProps) {
  const t = useTranslations('dataSources');
  const [param, template] = useWatch({ control, name: ['areaParam', 'areaTemplate'] });
  // "Other" stays chosen while its fields are still empty.
  const [chosen, setChosen] = useState<AreaMode | null>(null);
  const mode =
    chosen !== null && areaModeOf(param, template) === 'none'
      ? chosen
      : areaModeOf(param, template);

  function choose(next: string) {
    const picked = AREA_MODES.find((candidate) => candidate === next) ?? 'none';
    setChosen(picked);
    const values =
      picked === 'none' || picked === 'custom' ? { param: '', template: '' } : AREA_PRESETS[picked];
    if (picked !== 'custom') {
      setValue('areaParam', values.param, { shouldDirty: true });
      setValue('areaTemplate', values.template, { shouldDirty: true });
    }
  }

  return (
    <fieldset className="space-y-4 border-t border-border pt-5">
      <legend className="sr-only">{t('sourceForm.area.legend')}</legend>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-copy">{t('sourceForm.area.title')}</h3>
        <p className="text-sm text-copy-muted">{t('sourceForm.area.hint')}</p>
      </div>
      <SelectField
        id={`${idPrefix}-area-preset`}
        label={t('sourceForm.area.preset')}
        value={mode}
        onValueChange={choose}
        options={AREA_MODES.map((value) => ({
          value,
          label: t(`sourceForm.area.presets.${value}`),
        }))}
      />
      {mode !== 'none' && (
        <div className="grid grid-cols-1 gap-4">
          <TextField
            id={`${idPrefix}-area-param`}
            label={t('sourceForm.area.param')}
            hint={t('sourceForm.area.paramHint')}
            autoComplete="off"
            error={errorText(errors.areaParam?.message)}
            {...register('areaParam')}
          />
          <TextField
            id={`${idPrefix}-area-template`}
            label={t('sourceForm.area.template')}
            hint={t('sourceForm.area.templateHint')}
            autoComplete="off"
            error={errorText(errors.areaTemplate?.message)}
            {...register('areaTemplate')}
          />
        </div>
      )}
    </fieldset>
  );
}
