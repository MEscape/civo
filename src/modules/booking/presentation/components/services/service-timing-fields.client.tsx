'use client';

import { useId } from 'react';

import { Controller, useWatch } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { previewOccupancy } from '../../../application/contracts/occupancy-preview-model';
import { LENGTH_CHOICES } from '../../forms/service-length-options';
import { FormSection } from '../shared/form-section';

import { LengthSelectField } from './length-select-field.client';
import { OccupancyPreview } from './occupancy-preview';

import type { ResourceOptionDto } from '../../dto/service-dto';
import type { ServiceFormValues } from '../../schemas/service-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ServiceTimingFieldsProps {
  readonly form: UseFormReturn<ServiceFormValues>;
  /** Every resource the location can assign: the preview names the ones the service needs. */
  readonly resources: readonly ResourceOptionDto[];
  readonly errorText: (code: string | undefined) => string | undefined;
}

/**
 * How long an appointment takes and what surrounds it: the duration a citizen sees, and the
 * preparation and clean-up an employee is held for, with a live preview of who is occupied when. The
 * preview is the domain's own answer (`previewOccupancy`), not arithmetic of the screen.
 */
export function ServiceTimingFields({ form, resources, errorText }: ServiceTimingFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const { errors } = form.formState;
  const values = useWatch({ control: form.control });

  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const preview = previewOccupancy({
    durationMinutes: values.durationMinutes ?? 0,
    preparationMinutes: values.preparationMinutes ?? 0,
    cleanupMinutes: values.cleanupMinutes ?? 0,
    needsEmployee: values.employee !== 'none',
    resources: (values.resources ?? []).flatMap((link) => {
      const resource = link.resourceId === undefined ? undefined : byId.get(link.resourceId);
      return resource === undefined || link.isRequired !== true
        ? []
        : [
            {
              id: resource.id,
              name: resource.name,
              setupMinutes: resource.setupMinutes,
              teardownMinutes: resource.teardownMinutes,
            },
          ];
    }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FormSection title={t('services.timing.setTimes')}>
        <Controller
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-duration`}
              label={t('services.timing.duration')}
              hint={t('services.timing.durationHint')}
              value={field.value}
              choices={LENGTH_CHOICES.duration}
              error={errorText(errors.durationMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="preparationMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-preparation`}
              label={t('services.timing.preparation')}
              hint={t('services.timing.preparationHint')}
              value={field.value}
              choices={LENGTH_CHOICES.buffer}
              error={errorText(errors.preparationMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="cleanupMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-cleanup`}
              label={t('services.timing.cleanup')}
              hint={t('services.timing.cleanupHint')}
              value={field.value}
              choices={LENGTH_CHOICES.buffer}
              error={errorText(errors.cleanupMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <section
        aria-labelledby={`${id}-preview`}
        className="space-y-3 rounded-token border border-border bg-surface p-4"
      >
        <h3 id={`${id}-preview`} className="text-sm font-semibold text-copy">
          {t('services.timing.previewTitle')}
        </h3>
        <OccupancyPreview preview={preview} />
      </section>
    </div>
  );
}
