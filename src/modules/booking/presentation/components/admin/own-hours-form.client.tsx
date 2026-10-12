'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { updateOwnAvailabilityAction } from '../../actions/update-own-availability-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { useSaveForm } from '../../hooks/use-save-form';
import { ownAvailabilitySchema } from '../../schemas/own-availability-schema';
import { AvailabilityEditor } from '../availability/availability-editor';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { ResourceDto } from '../../dto/setup-dto';

export interface OwnHoursFormProps {
  readonly resource: ResourceDto;
}

/**
 * An employee's working hours for one of their calendars. Shown only when an
 * editor allowed it; the server checks the same things again and keeps every
 * other property of the resource as configured.
 */
export function OwnHoursForm({ resource }: OwnHoursFormProps) {
  const t = useTranslations('booking');
  const [plan, setPlan] = useState(() => planFormOf(resource.availability));
  const form = useSaveForm({
    schema: ownAvailabilitySchema,
    save: updateOwnAvailabilityAction,
    onSaved: () => undefined,
  });

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({ resourceId: resource.id, availability: plan });
      }}
    >
      <h3 className="text-base font-medium text-copy">
        {t('own.hoursFor', { name: resource.name })}
      </h3>
      <FormErrorSummary errors={form.errors} shownAtField={[]} />
      <AvailabilityEditor value={plan} onChange={setPlan} disabled={form.isPending} />
      <Button type="submit" disabled={form.isPending}>
        {t('own.hoursSave')}
      </Button>
    </form>
  );
}
