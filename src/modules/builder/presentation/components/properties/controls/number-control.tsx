import { Input } from '@components/ui/input';

import type { ControlProps } from './control-props';

export function NumberControl({ id, field, value, onChange, onCommit }: ControlProps) {
  return (
    <Input
      id={id}
      type="number"
      min={field.bounds?.min}
      max={field.bounds?.max}
      value={typeof value === 'number' ? value : ''}
      onChange={(event) => {
        // Empty or half-typed input is NaN; JSON only holds finite numbers, so it clears the prop.
        const parsed = event.target.valueAsNumber;
        onChange(Number.isFinite(parsed) ? parsed : undefined);
      }}
      onBlur={onCommit}
    />
  );
}
