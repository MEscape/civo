'use client';

import { TextField } from '@components/shared/text-field';

import { suggestEmailDomain } from '../forms/suggest-email-domain';

import { EmailSuggestion } from './email-suggestion';

import type { UseFormRegisterReturn } from 'react-hook-form';

export interface AuthEmailFieldProps {
  readonly id: string;
  readonly label: string;
  /** From the form's `register('email')`. */
  readonly registration: UseFormRegisterReturn;
  /** What is in the field now. */
  readonly value: string;
  /** The translated error, or `undefined` while the field is valid. */
  readonly error: string | undefined;
  /** Whether the person has been in the field and left it. */
  readonly isTouched: boolean;
  /** Puts a suggested address into the field. */
  readonly onAccept: (email: string) => void;
}

/**
 * The email field of the auth forms: ticked once the address is right, and
 * asking "did you mean …?" when the domain looks like a typo, so a mistake is
 * caught before an email goes to a stranger's inbox.
 */
export function AuthEmailField({
  id,
  label,
  registration,
  value,
  error,
  isTouched,
  onAccept,
}: AuthEmailFieldProps) {
  // Asked only once the person has left the field: a half-typed domain is not a typo.
  const suggestion = isTouched ? suggestEmailDomain(value) : null;

  return (
    <div className="space-y-1.5">
      <TextField
        id={id}
        label={label}
        type="email"
        inputMode="email"
        autoComplete="email"
        // An address that looks like a typo is not ticked: the question below comes first.
        isValid={isTouched && error === undefined && value !== '' && suggestion === null}
        error={error}
        {...registration}
      />
      <EmailSuggestion id={`${id}-suggestion`} suggestion={suggestion} onAccept={onAccept} />
    </div>
  );
}
