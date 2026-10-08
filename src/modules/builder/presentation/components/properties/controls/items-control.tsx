import { useId } from 'react';

import { Button } from '@components/ui/button';
import { Close } from '@components/ui/icons';
import { Input, Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { isJsonRecord } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { useComponentText } from '../../../hooks/use-component-text';

import type { ControlProps } from './control-props';
import type { PropItemFieldDescriptor } from '../../../../application/contracts/builder-constraints';

type Entry = Readonly<Record<string, JsonValue>>;

function toEntries(value: JsonValue | undefined): readonly Entry[] {
  return Array.isArray(value) ? value.filter((item): item is Entry => isJsonRecord(item)) : [];
}

interface ItemFieldInputProps {
  readonly itemField: PropItemFieldDescriptor;
  readonly value: JsonValue | undefined;
  readonly onChange: (value: string) => void;
  readonly onCommit: () => void;
}

function ItemFieldInput({ itemField, value, onChange, onCommit }: ItemFieldInputProps) {
  const text = useComponentText();
  const id = useId();
  const shared = {
    id,
    value: typeof value === 'string' ? value : '',
    onBlur: onCommit,
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {text.itemFieldLabel(itemField)}
      </Label>
      {itemField.multiline ? (
        <Textarea
          {...shared}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <Input
          type="text"
          {...shared}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}

/**
 * Edits a bounded list of small records (FAQ entries, tabs, cards, links).
 * Every entry is a fieldset of the platform's item fields; the platform
 * validates the stored list, so an incomplete entry only falls back on
 * render and is never lost while it is being typed.
 */
export function ItemsControl({ labelId, field, value, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const entries = toEntries(value);
  const max = field.bounds?.max ?? entries.length;

  const replace = (next: readonly Entry[]) => {
    onChange([...next]);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-3">
      {entries.length === 0 && (
        <p className="text-xs text-copy-muted">{t('properties.items.empty')}</p>
      )}
      <ol className="space-y-3">
        {entries.map((entry, index) => {
          const number = index + 1;
          return (
            // Entries have no identity of their own; their position is what the editor edits.
            // eslint-disable-next-line react/no-array-index-key -- see above
            <li key={index}>
              <fieldset className="space-y-2 rounded-token-sm border border-border p-3">
                <legend className="flex w-full items-center justify-between gap-2 px-1 text-xs font-medium text-copy">
                  {t('properties.items.entry', { number })}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('properties.items.remove', { number })}
                    onClick={() => {
                      replace(entries.filter((_, position) => position !== index));
                      onCommit();
                    }}
                  >
                    <Close aria-hidden="true" />
                  </Button>
                </legend>
                {field.itemFields.map((itemField) => (
                  <ItemFieldInput
                    key={itemField.key}
                    itemField={itemField}
                    value={entry[itemField.key]}
                    onChange={(next) => {
                      replace(
                        entries.map((current, position) =>
                          position === index ? { ...current, [itemField.key]: next } : current,
                        ),
                      );
                    }}
                    onCommit={onCommit}
                  />
                ))}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={entries.length >= max}
        onClick={() => {
          replace([...entries, {}]);
          onCommit();
        }}
      >
        {t('properties.items.add')}
      </Button>
      {entries.length >= max && (
        <p className="text-xs text-copy-muted">{t('properties.items.limit', { max })}</p>
      )}
    </div>
  );
}
