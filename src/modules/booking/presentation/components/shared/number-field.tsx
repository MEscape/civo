'use client';

import { useState } from 'react';

import { TextField } from '@components/shared/text-field';

export interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly min?: number;
  readonly max?: number;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  /** `null` when the field is emptied and `allowEmpty` is set. */
  readonly allowEmpty?: boolean;
  readonly onChange: (value: number | null) => void;
}

/**
 * A whole-number field. It keeps what the person typed as text, so clearing
 * the box to type a new number does not snap to zero in between; the number
 * is reported as soon as the text is one. To reset it from outside, remount
 * it with a different `key`.
 */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  hint,
  error,
  disabled,
  allowEmpty = false,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value));

  return (
    <TextField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      disabled={disabled}
      {...(hint === undefined ? {} : { hint })}
      error={error}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        if (raw.trim() === '') {
          if (allowEmpty) {
            onChange(null);
          }
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          onChange(Math.trunc(parsed));
        }
      }}
    />
  );
}
