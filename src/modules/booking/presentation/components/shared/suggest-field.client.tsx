'use client';

import { useRef } from 'react';

import { ChevronDown } from '@components/icons/icons';
import { FieldHint, FieldMessage, describedByIds } from '@components/shared/field';
import { Input, Label } from '@components/ui/input';

import { useAnchoredPosition } from '@hooks/use-anchored-position';

import { cn, trimToNull } from '@lib/utils';

import { useCreatableChoice } from '../../hooks/use-creatable-choice';

import { CreatableList } from './creatable-list.client';

export interface SuggestFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  /** The values already in use, offered to choose from; any other text can be added. */
  readonly suggestions: readonly string[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** What the row that adds the typed text says, e.g. `Add "x"`. */
  readonly createText: (value: string) => string;
  /** Said under the field while there is nothing in use yet: how to add the first. */
  readonly emptyText: string;
  readonly placeholder?: string | undefined;
  readonly disabled?: boolean | undefined;
}

/**
 * A field that offers the values in use (a category) in a list and adds what is typed as a new one
 * ("Add …"), as an ARIA combobox. It never reads as a mistake to have nothing yet: the list then says
 * how to add the first value. The text is the value, so a form needs no extra step to keep it.
 */
export function SuggestField({
  id,
  label,
  hint,
  error,
  suggestions,
  value,
  onValueChange,
  createText,
  emptyText,
  placeholder,
  disabled = false,
}: SuggestFieldProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const choice = useCreatableChoice({
    draft: value,
    suggestions,
    taken: [],
    normalize: trimToNull,
    isDisabled: disabled,
    onCommit: onValueChange,
    commitsOnEnter: false,
  });
  const { isShown, items, highlighted, panelId, listId, itemId } = choice;
  useAnchoredPosition(isShown, anchorRef, panelId);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div ref={anchorRef} className="relative">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isShown}
          aria-controls={isShown && items.length > 0 ? listId : undefined}
          aria-activedescendant={isShown && highlighted >= 0 ? itemId(highlighted) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds(Boolean(hint) && hintId, Boolean(error) && errorId)}
          className="pe-9"
          onChange={(event) => {
            onValueChange(event.target.value);
            choice.typed();
          }}
          onFocus={choice.open}
          onClick={choice.open}
          onBlur={choice.close}
          onKeyDown={choice.onKeyDown}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-copy-muted transition-transform motion-reduce:transition-none',
            isShown && 'rotate-180',
          )}
        />
        {isShown && (
          <CreatableList
            panelId={panelId}
            listId={listId}
            itemId={itemId}
            label={label}
            items={items}
            highlighted={highlighted}
            createText={createText}
            emptyText={emptyText}
            onChoose={choice.choose}
          />
        )}
      </div>
      <FieldHint id={hintId} hint={hint} />
      <FieldMessage id={errorId} message={error} />
    </div>
  );
}
