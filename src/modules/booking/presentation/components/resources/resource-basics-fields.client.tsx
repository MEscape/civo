'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { TextField } from '@components/shared/field';
import { FormSelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { LENGTH_CHOICES } from '../../forms/service-length-options';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { RESOURCE_KIND_FILTERS } from '../../schemas/parse-resource-list-input';
import { LengthSelectField } from '../services/length-select-field.client';
import { AdvancedNote } from '../shared/advanced-note.client';
import { FormSection } from '../shared/form-section';

import type { ResourceFormValues } from '../../schemas/resource-schema';
import type { UseFormReturn } from 'react-hook-form';

/** One column of the step: its title and four rows, laid on the rows of the grid both columns sit in. */
const COLUMN = 'lg:row-span-5 lg:grid lg:grid-rows-subgrid lg:gap-y-4 lg:space-y-0';

export interface ResourceBasicsFieldsProps {
  readonly form: UseFormReturn<ResourceFormValues>;
  /** The location the resource belongs to; it is chosen by where the manager is, never changed. */
  readonly locationName: string;
  /** The kind is set when it is made: bookings and services depend on it afterwards. */
  readonly isKindLocked: boolean;
  readonly errorText: (code: string | undefined) => string | undefined;
}

/** What a resource is: its name, kind and location, how many it takes at once, and its buffers. */
export function ResourceBasicsFields({
  form,
  locationName,
  isKindLocked,
  errorText,
}: ResourceBasicsFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const { errors } = form.formState;
  const kinds = RESOURCE_KIND_FILTERS.map((kind) => ({
    value: kind,
    label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
  }));

  // Both columns sit on the same rows, so a field and the one beside it start on the same line.
  return (
    <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
      <FormSection title={t('resources.form.sections.what')} className={COLUMN} isRowGroup>
        <TextField
          id={`${id}-name`}
          label={t('resources.form.name')}
          hint={t('resources.form.nameHint')}
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        {isKindLocked ? (
          <TextField
            id={`${id}-type`}
            label={t('resources.form.type')}
            hint={t('resources.form.typeLocked')}
            value={kinds.find((kind) => kind.value === form.getValues('type'))?.label ?? ''}
            readOnly
          />
        ) : (
          <FormSelectField
            control={form.control}
            name="type"
            id={`${id}-type`}
            label={t('resources.form.type')}
            options={kinds}
            errorText={errorText}
          />
        )}
        <TextField
          id={`${id}-location`}
          label={t('resources.form.location')}
          value={locationName}
          readOnly
        />
      </FormSection>
      <FormSection title={t('resources.form.sections.use')} className={COLUMN} isRowGroup>
        <TextField
          id={`${id}-capacity`}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          label={t('resources.form.capacity')}
          hint={t('resources.form.capacityHint')}
          error={errorText(errors.capacity?.message)}
          {...form.register('capacity', { valueAsNumber: true })}
        />
        <Controller
          control={form.control}
          name="setupMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-setup`}
              label={t('resources.form.setup')}
              hint={t('resources.form.setupHint')}
              value={field.value}
              choices={LENGTH_CHOICES.buffer}
              error={errorText(errors.setupMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="teardownMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-teardown`}
              label={t('resources.form.teardown')}
              hint={t('resources.form.teardownHint')}
              value={field.value}
              choices={LENGTH_CHOICES.buffer}
              error={errorText(errors.teardownMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <AdvancedNote
          id={`${id}-note`}
          title={t('resources.form.advanced')}
          titleHint={t('resources.form.advancedHint')}
          label={t('resources.form.note')}
          hint={t('resources.form.noteHint')}
          error={errorText(errors.internalNote?.message)}
          {...form.register('internalNote')}
        />
      </FormSection>
    </div>
  );
}
