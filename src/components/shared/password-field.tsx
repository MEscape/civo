'use client';

import { useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { AlertTriangle, Eye, EyeOff } from '@components/ui/icons';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { FieldMessage } from './field-message';

export interface PasswordFieldProps extends Omit<ComponentProps<typeof Input>, 'type' | 'id'> {
  readonly id: string;
  readonly label: string;
  /** Short help shown below the input. */
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
  /** Beside the label, for the one thing a person may need here ("Forgot your password?"). */
  readonly labelAction?: ReactNode;
  /** Below the field, described by it: a strength meter, the rules. Give it the id in `guidanceId`. */
  readonly children?: ReactNode;
  /** The id of what `children` draws, so the input is described by it. */
  readonly guidanceId?: string;
}

/**
 * A password input that can show what was typed and warns while Caps Lock is
 * on: the two causes of most failed sign-ins. Label, hint, error and the
 * warning are one accessible unit.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  labelAction,
  children,
  guidanceId,
  onBlur,
  onKeyDown,
  onKeyUp,
  ...inputProps
}: PasswordFieldProps) {
  const t = useTranslations('app');
  const [isVisible, setIsVisible] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const capsId = `${id}-caps`;
  const describedBy = [
    hint === undefined ? null : hintId,
    error === undefined ? null : errorId,
    isCapsLockOn ? capsId : null,
    guidanceId ?? null,
  ]
    .filter((value) => value !== null)
    .join(' ');

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setIsCapsLockOn(event.getModifierState('CapsLock'));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={isVisible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className="pr-10"
          onKeyDown={(event) => {
            trackCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            trackCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setIsCapsLockOn(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('password.toggle')}
          aria-pressed={isVisible}
          title={t('password.toggle')}
          className="absolute top-1 right-1 text-copy-muted"
          onClick={() => {
            setIsVisible((current) => !current);
          }}
        >
          {isVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {isCapsLockOn && (
        <p id={capsId} role="status" className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {t('password.capsLock')}
        </p>
      )}
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={errorId} message={error} />
      {children}
    </div>
  );
}
