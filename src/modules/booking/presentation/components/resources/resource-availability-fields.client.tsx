'use client';

import { Controller, useWatch } from 'react-hook-form';

import { RadioCardGroup } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { useWeekSummary } from '../../hooks/use-week-summary';
import { FormSection } from '../shared/form-section';
import { PeriodsEditor } from '../shared/periods-editor.client';
import { WeeklyHoursEditor } from '../shared/weekly-hours-editor.client';

import type { DayDto, ExceptionInputDto } from '../../dto/location-dto';
import type { ResourceFormValues } from '../../schemas/resource-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ResourceAvailabilityFieldsProps {
  readonly form: UseFormReturn<ResourceFormValues>;
  /** The location's week, to say what "like the location" means. */
  readonly locationWeekly: readonly DayDto[];
  readonly isPending: boolean;
  readonly translateErrors: (subtree: unknown) => Record<string, string>;
}

/**
 * When a resource can be used: like its location (the default; a change of the location's hours
 * reaches it by itself), or on its own week inside the location's hours. Beside it, the periods it is
 * blocked. The week editor is the one the location uses.
 */
export function ResourceAvailabilityFields({
  form,
  locationWeekly,
  isPending,
  translateErrors,
}: ResourceAvailabilityFieldsProps) {
  const t = useTranslations('booking');
  const summarize = useWeekSummary();
  const followsLocation = useWatch({ control: form.control, name: 'followsLocation' });
  const { errors } = form.formState;

  return (
    <div className="space-y-8">
      <div>
        <Controller
          control={form.control}
          name="followsLocation"
          render={({ field }) => (
            <RadioCardGroup
              legend={t('resources.form.when')}
              name={field.name}
              value={field.value ? 'location' : 'own'}
              disabled={isPending}
              className="sm:grid-cols-2"
              options={[
                {
                  value: 'location',
                  label: t('resources.form.followsLocation'),
                  description: t('resources.form.followsLocationDescription', {
                    hours: summarize(locationWeekly).join(' · '),
                  }),
                },
                {
                  value: 'own',
                  label: t('resources.form.own'),
                  description: t('resources.form.ownDescription'),
                },
              ]}
              onValueChange={(value) => {
                field.onChange(value === 'location');
              }}
            />
          )}
        />
      </div>
      {!followsLocation && (
        // The week is wide (a bar and its fields for each of seven days): it takes the whole row.
        <div>
          <Controller
            control={form.control}
            name="openingHours.weekly"
            render={({ field }) => (
              <WeeklyHoursEditor
                value={field.value}
                onChange={(week: DayDto[]) => {
                  field.onChange(week);
                }}
                errors={translateErrors(errors.openingHours?.weekly)}
                disabled={isPending}
                bounds={locationWeekly}
              />
            )}
          />
        </div>
      )}
      <FormSection title={t('resources.form.blocks.title')}>
        <p className="text-sm text-copy-muted">{t('resources.form.blocks.description')}</p>
        <Controller
          control={form.control}
          name="openingHours.exceptions"
          render={({ field }) => (
            <PeriodsEditor
              words="resources.form.blocks"
              value={field.value}
              onChange={(blocks: ExceptionInputDto[]) => {
                field.onChange(blocks);
              }}
              errors={translateErrors(errors.openingHours?.exceptions)}
              disabled={isPending}
            />
          )}
        />
      </FormSection>
    </div>
  );
}
