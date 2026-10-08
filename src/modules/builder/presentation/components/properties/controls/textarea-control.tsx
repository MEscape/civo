import { Textarea } from '@components/ui/input';

import { useComponentText } from '../../../hooks/use-component-text';

import type { ControlProps } from './control-props';

export function TextareaControl({ id, field, value, onChange, onCommit }: ControlProps) {
  const text = useComponentText();
  return (
    <Textarea
      id={id}
      value={typeof value === 'string' ? value : ''}
      placeholder={text.fieldPlaceholder(field)}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onBlur={onCommit}
    />
  );
}
