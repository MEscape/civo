import { FieldMessage } from '@components/shared/field-message';
import { Input, Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { INFORMATION_FIELD_MESSAGE_KEYS } from '../../messages/message-keys';

import type { InformationField } from '../../../application/contracts/booking-constraints';

interface FieldTraits {
  readonly type: 'text' | 'email' | 'tel';
  readonly autoComplete: string;
  readonly inputMode?: 'email' | 'tel';
}

const TRAITS: Readonly<Record<Exclude<InformationField, 'notes'>, FieldTraits>> = {
  firstName: { type: 'text', autoComplete: 'given-name' },
  lastName: { type: 'text', autoComplete: 'family-name' },
  email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  referenceNumber: { type: 'text', autoComplete: 'off' },
};

export interface DetailFieldProps {
  readonly id: string;
  readonly field: InformationField;
  readonly isRequired: boolean;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
}

/** One detail the service asks for: a labelled input (a text area for notes) with its error. */
export function DetailField({ id, field, isRequired, value, error, onChange }: DetailFieldProps) {
  const t = useTranslations('booking');
  const label = t(INFORMATION_FIELD_MESSAGE_KEYS[field]);
  const requiredMark = isRequired ? t('details.required') : t('details.optional');
  const errorId = `${id}-error`;
  const accessibility = {
    id,
    value,
    'aria-invalid': error === undefined ? undefined : true,
    'aria-describedby': error === undefined ? undefined : errorId,
    'aria-required': isRequired,
  } as const;

  return (
    <div className={field === 'notes' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <Label htmlFor={id}>
        {label} <span className="text-copy-muted">({requiredMark})</span>
      </Label>
      {field === 'notes' ? (
        <Textarea
          {...accessibility}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <Input
          {...accessibility}
          type={TRAITS[field].type}
          inputMode={TRAITS[field].inputMode}
          autoComplete={TRAITS[field].autoComplete}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}
