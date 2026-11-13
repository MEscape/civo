'use client';

import { TextField } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDetailsForm } from '../../hooks/use-details-form';
import { TextAreaField } from '../shared/text-area-field.client';

import type { CatalogServiceDto } from '../../dto/catalog-dto';
import type { JourneyDetails } from '../../forms/journey-state';

export interface DetailsFormProps {
  readonly service: CatalogServiceDto;
  readonly details: JourneyDetails;
  readonly onDone: (details: JourneyDetails) => void;
}

const INPUT_TYPE = {
  firstName: 'text',
  lastName: 'text',
  email: 'email',
  phone: 'tel',
  referenceNumber: 'text',
  notes: 'text',
} as const;

const AUTOCOMPLETE = {
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  phone: 'tel',
  referenceNumber: 'off',
  notes: 'off',
} as const;

// @unsaved-work none the details stay in the journey when the visitor goes back or loses the time
/** The fields the service asks for; nothing is sent until the visitor confirms on the next step. */
export function DetailsForm({ service, details, onDone }: DetailsFormProps) {
  const t = useTranslations('booking');
  const { form, errorOf, submit } = useDetailsForm(service, details, onDone);

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {service.information.map(({ field, isRequired }) => {
        const label = t(`public.fields.${field}`);
        const shared = {
          id: `booking-${field}`,
          label: isRequired ? label : t('public.optional', { label }),
          error: errorOf(field),
          required: isRequired,
          ...form.register(field),
        };
        return field === 'notes' ? (
          <TextAreaField key={field} rows={3} className="text-base" {...shared} />
        ) : (
          <TextField
            key={field}
            type={INPUT_TYPE[field]}
            autoComplete={AUTOCOMPLETE[field]}
            className="h-11 text-base"
            {...(field === 'email' ? { hint: t('public.emailHint') } : {})}
            {...shared}
          />
        );
      })}
      <Button type="submit" size="lg" className="min-h-11">
        {t('public.next')}
      </Button>
    </form>
  );
}
