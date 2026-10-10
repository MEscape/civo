import type { ComponentProps } from 'react';

import { Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { FieldMessage } from './field-message';

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends Omit<ComponentProps<typeof Select>, 'children'> {
  readonly id: string;
  readonly label: string;
  readonly options: readonly SelectFieldOption[];
  /** Shown while no value is chosen. */
  readonly placeholder?: string;
  /** A translated error message to display; `undefined` shows no error. */
  readonly errorMessage?: string | undefined;
}

/**
 * Label, select and its associated error message as one accessible unit.
 * It is controlled (`value`/`onValueChange`): a form library's `register`
 * cannot drive a Radix select, use `FormSelectField` for react-hook-form.
 */
export function SelectField({
  id,
  label,
  options,
  placeholder,
  errorMessage,
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
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FieldMessage id={errorId} message={errorMessage} />
    </div>
  );
}
