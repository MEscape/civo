'use client';

import { useEffect } from 'react';

import { TextField } from '@components/shared/field';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useBookingLookup } from '../../hooks/use-booking-lookup';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import type { FoundBooking } from '../../hooks/use-booking-lookup';

export interface LookupFormProps {
  readonly websiteId: string;
  readonly initialReference: string | undefined;
  readonly shouldFocusReference?: boolean;
  readonly onFound: (found: FoundBooking) => void;
}

// @unsaved-work none two short fields, typed again in seconds
/** The booking number and the address it was made with: the only way to reach a booking. */
export function LookupForm({
  websiteId,
  initialReference,
  shouldFocusReference = false,
  onFound,
}: LookupFormProps) {
  const t = useTranslations('booking');
  const { form, find, isPending, formCode } = useBookingLookup(
    websiteId,
    initialReference,
    onFound,
  );
  const textOf = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  const { setFocus } = form;

  useEffect(() => {
    if (shouldFocusReference) {
      setFocus('reference');
    }
  }, [setFocus, shouldFocusReference]);

  return (
    <form noValidate onSubmit={find} aria-busy={isPending} className="space-y-4">
      <p className="text-sm text-copy-muted">{t('public.manage.intro')}</p>
      <TextField
        id="booking-lookup-reference"
        label={t('public.manage.reference')}
        autoComplete="off"
        spellCheck={false}
        className="h-11 font-mono text-base uppercase"
        error={textOf(form.formState.errors.reference?.message)}
        {...form.register('reference')}
      />
      <TextField
        id="booking-lookup-email"
        type="email"
        autoComplete="email"
        label={t('public.manage.email')}
        className="h-11 text-base"
        error={textOf(form.formState.errors.email?.message)}
        {...form.register('email')}
      />
      {formCode !== null && (
        <Alert variant="danger" role="alert">
          <AlertDescription>{textOf(formCode)}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="min-h-11" disabled={isPending}>
        {isPending ? t('public.manage.finding') : t('public.manage.find')}
      </Button>
    </form>
  );
}
