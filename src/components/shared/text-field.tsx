'use client';

import type { ComponentProps } from 'react';

import { Check } from '@components/ui/icons';
import { Input, Label } from '@components/ui/input';

import { cn } from '@lib/utils';

import { FieldMessage } from './field-message';

export interface TextFieldProps extends ComponentProps<typeof Input> {
  readonly id: string;
  readonly label: string;
  /** Short help shown below the input, e.g. a password rule. */
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
  /** Ticks the field once its value is right, so a person knows before submitting. */
  readonly isValid?: boolean;
}

/** Label, input, hint and error message as one accessible unit. */
export function TextField({
  id,
  label,
  hint,
  error,
  isValid = false,
  className,
  ...inputProps
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={cn(isValid && 'pr-9', className)}
          {...inputProps}
        />
        {isValid && (
          <Check
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-success"
            aria-hidden="true"
          />
        )}
      </div>

      {hint !== undefined && (
        <p id={hintId} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}
