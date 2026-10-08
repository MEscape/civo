import type { ComponentProps, ReactNode } from 'react';

import { Label } from '@components/ui/input';
import { Select, SelectTrigger } from '@components/ui/select';

import { FieldMessage } from './field-message';

export interface SelectFieldProps extends ComponentProps<typeof Select> {
  readonly id: string;
  readonly label: string;
  readonly errorMessage?: ReactNode;
}

/** Label, select and its associated error message as one accessible unit. */
export function SelectField({
  id,
  label,
  errorMessage,
  children,
  ...selectProps
}: SelectFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>

      <Select {...selectProps}>
        <SelectTrigger
          id={id}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
        >
          {children}
        </SelectTrigger>
      </Select>

      <FieldMessage id={errorId} message={errorMessage} />
    </div>
  );
}
