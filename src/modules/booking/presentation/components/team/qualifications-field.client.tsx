'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { TagField } from '../shared/tag-field.client';

import type { TeamMemberFormValues } from '../../schemas/team-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface QualificationsFieldProps {
  readonly form: UseFormReturn<TeamMemberFormValues>;
  /** The qualifications held in the team, offered to choose from; a new one can be typed. */
  readonly known: readonly string[];
  readonly isPending: boolean;
  readonly translateErrors: (subtree: unknown) => Record<string, string>;
}

const normalize = (raw: string) => {
  const key = raw.trim();
  return key === '' || key.length > SERVICE_LIMITS.qualificationMax ? null : key;
};

/**
 * What an employee is qualified for: granted by managers only (BD-06), and what a service's
 * "required qualification" is matched against.
 */
export function QualificationsField({
  form,
  known,
  isPending,
  translateErrors,
}: QualificationsFieldProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <Controller
      control={form.control}
      name="qualifications"
      render={({ field }) => (
        <TagField
          id={`${id}-qualifications`}
          label={t('team.qualifications.label')}
          suggestions={known}
          values={field.value}
          onValuesChange={(values) => {
            field.onChange([...values]);
          }}
          placeholder={t('team.qualifications.placeholder')}
          emptyText={t('team.qualifications.empty')}
          createText={(value) => t('team.qualifications.create', { value })}
          normalize={normalize}
          removeText={(label) => t('team.qualifications.remove', { label })}
          error={
            Object.values(
              translateErrors({ qualifications: form.formState.errors.qualifications }),
            )[0]
          }
          disabled={isPending}
        />
      )}
    />
  );
}
