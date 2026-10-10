import type { ComponentProps } from 'react';

import { FieldMessage } from './field-message';

export interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'id'> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
}

/** A native checkbox with its label, hint and error: reliable with every assistive technology. */
export function CheckboxField({ id, label, hint, error, ...inputProps }: CheckboxFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={hint === undefined ? undefined : `${id}-hint`}
          className="mt-0.5 size-4 rounded border-border-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...inputProps}
        />
        <label htmlFor={id} className="text-sm text-copy">
          {label}
        </label>
      </div>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="pl-6 text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={`${id}-error`} message={error} className="pl-6" />
    </div>
  );
}
