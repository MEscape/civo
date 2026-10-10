'use client';

import { useId, useState } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

export interface ParticipantsStepProps {
  readonly initial: number;
  readonly max: number;
  readonly onSubmit: (participants: number) => void;
}

/** How many people the booking is for. Only shown when the service allows more than one. */
export function ParticipantsStep({ initial, max, onSubmit }: ParticipantsStepProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [text, setText] = useState(String(initial));
  const [touched, setTouched] = useState(false);

  const value = Number(text);
  const isValid = Number.isInteger(value) && value >= 1 && value <= max;

  return (
    <form
      noValidate
      className="max-w-xs space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (isValid) {
          onSubmit(value);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t('participants.label')}</Label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={text}
          aria-invalid={touched && !isValid ? true : undefined}
          aria-describedby={`${id}-hint ${id}-error`}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <p id={`${id}-hint`} className="text-xs text-copy-muted">
          {t('participants.hint', { max })}
        </p>
        <FieldMessage
          id={`${id}-error`}
          message={touched && !isValid ? t('participants.invalid', { max }) : undefined}
        />
      </div>
      <Button type="submit">{t('actions.continue')}</Button>
    </form>
  );
}
