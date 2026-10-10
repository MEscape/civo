import { FieldMessage } from '@components/shared/field-message';
import { Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface OptionSelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onValueChange: (value: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly disabled?: boolean | undefined;
}

/**
 * A labelled choice from a short list. Option values must not be empty:
 * the picker reserves the empty value for "nothing chosen", so "all" and
 * "any" are explicit values of their own.
 */
export function OptionSelectField({
  id,
  label,
  value,
  options,
  onValueChange,
  error,
  hint,
  disabled,
}: OptionSelectFieldProps) {
  const describedBy = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
        <SelectTrigger
          id={id}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}
