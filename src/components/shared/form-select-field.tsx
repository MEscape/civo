'use client';

import { useController } from 'react-hook-form';

import { SelectField } from './select-field';

import type { SelectFieldOption } from './select-field';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export interface FormSelectFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> {
  readonly control: Control<TValues>;
  readonly name: TName;
  readonly id: string;
  readonly label: string;
  readonly options: readonly SelectFieldOption[];
  readonly placeholder?: string;
  /** Turns the field's error code (the message the resolver stored) into translated text. */
  readonly errorText: (code: string | undefined) => string | undefined;
}

/**
 * A `SelectField` bound to one react-hook-form value. A Radix select has no
 * native input behind it, so it is bound through the controller instead of
 * `register`.
 */
export function FormSelectField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  id,
  label,
  options,
  placeholder,
  errorText,
}: FormSelectFieldProps<TValues, TName>) {
  const { field, fieldState } = useController({ control, name });
  const current: unknown = field.value;

  return (
    <SelectField
      id={id}
      label={label}
      options={options}
      {...(placeholder === undefined ? {} : { placeholder })}
      name={field.name}
      value={typeof current === 'string' ? current : ''}
      onValueChange={(chosen) => {
        field.onChange(chosen);
      }}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          field.onBlur();
        }
      }}
      errorMessage={errorText(fieldState.error?.message)}
    />
  );
}
