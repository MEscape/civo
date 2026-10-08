import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { useComponentText } from '../../../hooks/use-component-text';

import type { ControlProps } from './control-props';

export function SelectControl({ id, field, value, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const text = useComponentText();
  // Only scalar option values are ever selectable; anything else shows the placeholder.
  const selectedText = typeof value === 'string' || typeof value === 'number' ? String(value) : '';

  function handleValueChange(chosenText: string): void {
    // Option values may be numbers; the DOM only returns text, so map back to the declared value.
    const chosen = field.options.find((option) => String(option.value) === chosenText);
    if (chosen === undefined) {
      return;
    }
    onChange(chosen.value);
    onCommit();
  }

  return (
    <Select value={selectedText} onValueChange={handleValueChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('properties.selectPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            {text.optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
