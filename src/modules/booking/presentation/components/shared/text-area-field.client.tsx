'use client';

import type { ComponentProps } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Label, Textarea } from '@components/ui/input';

import { isDefined } from '@lib/utils';

export interface TextAreaFieldProps extends ComponentProps<typeof Textarea> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
}

/** Label, text area, hint and error message as one accessible unit (the multi-line `TextField`). */
export function TextAreaField({ id, label, hint, error, ...areaProps }: TextAreaFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter(isDefined)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...areaProps}
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
