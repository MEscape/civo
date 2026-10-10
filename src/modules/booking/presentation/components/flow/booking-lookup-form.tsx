import { useId, useState } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { ErrorNotice } from '../shared/error-notice';

export interface BookingLookupFormProps {
  readonly errorCode: string | null;
  readonly isPending: boolean;
  readonly onFind: (reference: string, email: string) => void;
  readonly onBack: () => void;
}

/** Reference and e-mail address: together they prove the booking is the visitor's. */
export function BookingLookupForm({
  errorCode,
  isPending,
  onFind,
  onBack,
}: BookingLookupFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const isReferenceMissing = touched && reference.trim() === '';
  const isEmailMissing = touched && email.trim() === '';

  return (
    <form
      noValidate
      className="max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (reference.trim() !== '' && email.trim() !== '') {
          onFind(reference, email);
        }
      }}
    >
      <p className="text-sm text-copy-muted">{t('manage.intro')}</p>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reference`}>{t('manage.reference')}</Label>
        <Input
          id={`${id}-reference`}
          value={reference}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={isReferenceMissing ? true : undefined}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        <FieldMessage
          id={`${id}-reference-error`}
          message={isReferenceMissing ? t('manage.referenceRequired') : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-email`}>{t('manage.email')}</Label>
        <Input
          id={`${id}-email`}
          type="email"
          value={email}
          autoComplete="email"
          aria-invalid={isEmailMissing ? true : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <FieldMessage
          id={`${id}-email-error`}
          message={isEmailMissing ? t('manage.emailRequired') : undefined}
        />
      </div>
      {errorCode !== null && <ErrorNotice code={errorCode} focus />}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('actions.back')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('manage.searching') : t('manage.find')}
        </Button>
      </div>
    </form>
  );
}
