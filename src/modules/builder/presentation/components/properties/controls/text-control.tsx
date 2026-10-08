import { Input } from '@components/ui/input';

import { useComponentText } from '../../../hooks/use-component-text';

import type { ControlProps } from './control-props';

export function TextControl({ id, field, value, onChange, onCommit }: ControlProps) {
  const text = useComponentText();
  return (
    <Input
      id={id}
      type="text"
      value={typeof value === 'string' ? value : ''}
      placeholder={text.fieldPlaceholder(field)}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onBlur={onCommit}
    />
  );
}
