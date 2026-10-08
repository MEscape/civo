'use client';

import type { ComponentProps } from 'react';

import { Input, Label } from '@components/ui/input';

import { FieldMessage } from './field-message';

export interface TextFieldProps extends ComponentProps<typeof Input> {
  readonly id: string;
  readonly label: string;
  /** Short help shown below the input, e.g. a password rule. */
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
}

/** Label, input, hint and error message as one accessible unit. */
export function TextField({ id, label, hint, error, ...inputProps }: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...inputProps}
      />

      {hint !== undefined && (
        <p id={hintId} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}
