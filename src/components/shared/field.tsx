import type { ComponentProps, ReactNode } from 'react';

import { Check } from '@components/icons/icons';
import { Input, Label, Textarea } from '@components/ui/input';

import { cn } from '@lib/utils';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Joins the ids a control is described by. Returns `undefined` when there are
 * none, so no empty `aria-describedby` is rendered. Pass `condition && id` for
 * ids that only exist while their element renders.
 */
export function describedByIds(
  ...ids: ReadonlyArray<string | false | null | undefined>
): string | undefined {
  const joined = ids.filter((id): id is string => typeof id === 'string' && id !== '').join(' ');
  return joined === '' ? undefined : joined;
}

/* -------------------------------------------------------------------------- */
/* FieldHint                                                                  */
/* -------------------------------------------------------------------------- */

export interface FieldHintProps {
  readonly id: string;
  readonly hint?: ReactNode;
  readonly className?: string | undefined;
}

/** Short help below a control. Renders nothing for an empty hint, like `FieldMessage`. */
export function FieldHint({ id, hint, className }: FieldHintProps) {
  if (!hint) {
    return null;
  }

  return (
    <p id={id} className={cn('text-xs text-copy-muted', className)}>
      {hint}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* FieldMessage                                                               */
/* -------------------------------------------------------------------------- */

export interface FieldMessageProps {
  readonly id: string;
  readonly message?: ReactNode;
  readonly className?: string | undefined;
}

/** An error below a control, announced when it appears. Renders nothing without a message. */
export function FieldMessage({ id, message, className }: FieldMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className={cn('text-xs text-danger', className)}>
      {message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* FieldSuccess                                                               */
/* -------------------------------------------------------------------------- */

/** A form's "done" beside its fields or in its footer: ticked, so colour is not the only signal. */
export function FieldSuccess({ children }: { readonly children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-success">
      <Check className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* TextField                                                                  */
/* -------------------------------------------------------------------------- */

export interface TextFieldProps extends ComponentProps<typeof Input> {
  readonly id: string;
  readonly label: string;
  /** Short help shown below the input, e.g. a password rule. */
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
  /** Ticks the field once its value is right, so a person knows before submitting. */
  readonly isValid?: boolean;
  /** Read out, not shown: for a field in a strip of controls that say what they are by their content. */
  readonly isLabelHidden?: boolean;
}

/**
 * Label, input, hint and error message as one accessible unit. The field owns
 * `id`, `aria-invalid` and `aria-describedby`; a caller's `aria-describedby`
 * is kept and appended after the hint and the error.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  isValid = false,
  isLabelHidden = false,
  className,
  'aria-describedby': ariaDescribedBy,
  ...inputProps
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  // A tick beside an error would say two things at once.
  const showTick = isValid && !hasError;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={isLabelHidden ? 'sr-only' : undefined}>
        {label}
      </Label>
      <div className="relative">
        <Input
          {...inputProps}
          id={id}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedByIds(
            Boolean(hint) && hintId,
            hasError && errorId,
            ariaDescribedBy,
          )}
          className={cn(showTick && 'pe-9', className)}
        />
        {showTick && (
          <Check
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-success"
            aria-hidden="true"
          />
        )}
      </div>

      <FieldHint id={hintId} hint={hint} />
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TextareaField                                                              */
/* -------------------------------------------------------------------------- */

export interface TextareaFieldProps extends ComponentProps<typeof Textarea> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly error?: string | undefined;
}

/** `TextField` for longer text: the same label, hint, error and `aria-*` wiring around a textarea. */
export function TextareaField({
  id,
  label,
  hint,
  error,
  'aria-describedby': ariaDescribedBy,
  ...textareaProps
}: TextareaFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        {...textareaProps}
        id={id}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedByIds(
          Boolean(hint) && hintId,
          hasError && errorId,
          ariaDescribedBy,
        )}
      />
      <FieldHint id={hintId} hint={hint} />
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CheckboxField                                                              */
/* -------------------------------------------------------------------------- */

export interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'id'> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
}

/** A native checkbox with its label, hint and error: reliable with every assistive technology. */
export function CheckboxField({
  id,
  label,
  hint,
  error,
  'aria-describedby': ariaDescribedBy,
  ...inputProps
}: CheckboxFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          {...inputProps}
          id={id}
          type="checkbox"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedByIds(
            Boolean(hint) && hintId,
            hasError && errorId,
            ariaDescribedBy,
          )}
          className="mt-0.5 size-4 rounded border-border-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <label htmlFor={id} className="text-sm text-copy">
          {label}
        </label>
      </div>
      <FieldHint id={hintId} hint={hint} className="pl-6" />
      <FieldMessage id={errorId} message={error} className="pl-6" />
    </div>
  );
}
