'use client';

import type { ComponentProps, ReactNode } from 'react';

import { AlertTriangle, Eye, EyeOff } from '@components/icons/icons';
import { FieldHint, FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { usePasswordField } from '../../hooks/use-password-field';

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
 * warning are one accessible unit. The field owns `type`, `aria-invalid`,
 * `aria-describedby` and the blur/key handlers (it calls the ones you pass);
 * use `guidanceId` to add what the input should be described by.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  labelAction,
  children,
  guidanceId,
  className,
  onBlur,
  onKeyDown,
  onKeyUp,
  ...inputProps
}: PasswordFieldProps) {
  const t = useTranslations('auth');
  const hasError = Boolean(error);
  const field = usePasswordField({
    id,
    // Mirrors what renders: `FieldHint` and `FieldMessage` skip empty content.
    hasHint: Boolean(hint),
    hasError,
    guidanceId,
    onBlur,
    onKeyDown,
    onKeyUp,
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          {...inputProps}
          id={id}
          type={field.isVisible ? 'text' : 'password'}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={field.describedBy}
          // Room for the toggle; a caller's classes add to it instead of replacing it.
          className={cn('pe-10', className)}
          {...field.inputHandlers}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('password.toggle')}
          aria-pressed={field.isVisible}
          title={t('password.toggle')}
          className="absolute end-1 top-1 text-copy-muted"
          onClick={field.toggleVisible}
        >
          {field.isVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {field.isCapsLockOn && (
        <p
          id={field.ids.caps}
          role="status"
          className="flex items-center gap-1.5 text-xs text-warning"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {t('password.capsLock')}
        </p>
      )}
      <FieldHint id={field.ids.hint} hint={hint} />
      <FieldMessage id={field.ids.error} message={error} />
      {children}
    </div>
  );
}
