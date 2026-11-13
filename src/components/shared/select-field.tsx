'use client';

import { useId } from 'react';
import type { ComponentProps } from 'react';

import { useController } from 'react-hook-form';

import { Label } from '@components/ui/input';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useAutocomplete } from '@hooks/use-autocomplete';

import { cn } from '@lib/utils';

import { FieldMessage, TextField } from './field';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';

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

/* -------------------------------------------------------------------------- */
/* RadioCardGroup                                                             */
/* -------------------------------------------------------------------------- */

interface RadioCardOption {
  readonly value: string;
  /** Already translated. */
  readonly label: string;
  readonly description?: string;
}

interface RadioCardGroupProps {
  /** What is being chosen; the group's accessible name. */
  readonly legend: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly RadioCardOption[];
  readonly onValueChange: (value: string) => void;
  /** Already translated; tied to the group for assistive technology. */
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Lays the cards out, e.g. `sm:grid-cols-3` for a row; the default is one column. */
  readonly className?: string | undefined;
}

/**
 * One choice from a few, each as a card with a sentence of explanation. A `RadioGroup` under the hood, so
 * assistive technology says "choose one of these" and the arrow keys move the choice; the card is the
 * label of its radio, so a press anywhere on it chooses, and the chosen card carries the radio's dot as
 * well as a ring, so it is not told by colour alone.
 */
export function RadioCardGroup({
  legend,
  name,
  value,
  options,
  onValueChange,
  error,
  disabled = false,
  className,
}: RadioCardGroupProps) {
  const id = useId();
  const legendId = `${id}-legend`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <p id={legendId} className="text-sm font-medium text-copy">
        {legend}
      </p>
      <RadioGroup
        name={name}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        className={cn('auto-rows-fr', className)}
        aria-labelledby={legendId}
        aria-describedby={error ? errorId : undefined}
      >
        {options.map((option) => {
          const itemId = `${id}-${option.value}`;
          return (
            <label key={option.value} htmlFor={itemId} className="block">
              <div
                className={cn(
                  'flex h-full items-start gap-3 rounded-token border border-border bg-surface p-4 ring-accent',
                  'has-[[data-state=checked]]:ring-2',
                  disabled && 'opacity-50',
                )}
              >
                <RadioGroupItem id={itemId} value={option.value} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-copy">{option.label}</span>
                  {option.description !== undefined && (
                    <span className="mt-1 block text-xs text-copy-muted">{option.description}</span>
                  )}
                </span>
              </div>
            </label>
          );
        })}
      </RadioGroup>
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AutocompleteField                                                          */
/* -------------------------------------------------------------------------- */

export interface AutocompleteOption {
  /** What is written into the field when the option is picked. */
  readonly value: string;
  /** Secondary text, to the right: an offset, a country. */
  readonly detail?: string;
}

export interface AutocompleteFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly value: string;
  /** Called for every edit: any text is accepted, a list only suggests. */
  readonly onValueChange: (value: string) => void;
  /** Called when an option is picked, after `onValueChange` with its value. */
  readonly onPick?: ((option: AutocompleteOption) => void) | undefined;
  readonly options: readonly AutocompleteOption[];
  /** Whether the options for the text now in the field are still on their way. */
  readonly isSearching?: boolean | undefined;
  readonly searchingLabel: string;
  readonly disabled?: boolean | undefined;
  readonly autoComplete?: string | undefined;
}

/**
 * A text field with a list of suggestions that the keyboard drives (arrows, Enter, Escape), as an
 * ARIA combobox. The list only suggests: typed text is always kept, so a place or a zone the list
 * does not know is still accepted. The caller decides what the options are and how they are found.
 */
export function AutocompleteField({
  id,
  label,
  hint,
  error,
  value,
  onValueChange,
  onPick,
  options,
  isSearching = false,
  searchingLabel,
  disabled = false,
  autoComplete = 'off',
}: AutocompleteFieldProps) {
  const combobox = useAutocomplete({
    value,
    options,
    isSearching,
    isDisabled: disabled,
    onValueChange,
    onPick,
  });
  const { showList, highlighted, listId, optionId } = combobox;

  return (
    <div className="relative">
      <TextField
        id={id}
        label={label}
        {...(hint === undefined ? {} : { hint })}
        error={error}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && highlighted >= 0 ? optionId(highlighted) : undefined}
        {...combobox.inputHandlers}
      />
      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-token border border-border bg-surface shadow-md">
          {options.length > 0 ? (
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              className="max-h-64 overflow-auto py-1"
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === highlighted}
                  // Picked before the input loses focus, or the list would close under the click.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    combobox.choose(option);
                  }}
                  className={cn(
                    'flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 text-sm text-copy hover:bg-primary/10',
                    index === highlighted && 'bg-primary/10',
                  )}
                >
                  <span className="min-w-0 truncate">{option.value}</span>
                  {option.detail !== undefined && (
                    <span className="shrink-0 text-xs text-copy-muted">{option.detail}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p role="status" className="px-3 py-2 text-sm text-copy-muted">
              {searchingLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
