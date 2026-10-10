import { useState } from 'react';

import { Input } from '@components/ui/input';

import type { ControlProps } from './control-props';

/**
 * A whole number within the platform's bounds. The shown value is the
 * effective one (the stored number or the prop's default). While the field is
 * emptied for retyping, the prop keeps its last number and only the text is
 * blank; leaving the field restores the shown value.
 */
export function NumberControl({ id, field, value, onChange, onCommit }: ControlProps) {
  const [emptiedText, setEmptiedText] = useState<string | null>(null);
  const shown = emptiedText ?? (typeof value === 'number' ? String(value) : '');

  return (
    <Input
      id={id}
      type="number"
      min={field.bounds?.min}
      max={field.bounds?.max}
      value={shown}
      onChange={(event) => {
        // Empty or half-typed input is NaN; JSON only holds finite numbers, so it is not stored.
        const parsed = event.target.valueAsNumber;
        if (Number.isFinite(parsed)) {
          setEmptiedText(null);
          onChange(parsed);
          return;
        }
        setEmptiedText(event.target.value);
      }}
      onBlur={() => {
        setEmptiedText(null);
        onCommit();
      }}
    />
  );
}
