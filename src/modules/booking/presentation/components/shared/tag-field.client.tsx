'use client';

import { useRef, useState } from 'react';

import { Close } from '@components/icons/icons';
import { describedByIds, FieldHint, FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useAnchoredPosition } from '@hooks/use-anchored-position';

import { cn, trimToNull, unique } from '@lib/utils';

import { useCreatableChoice } from '../../hooks/use-creatable-choice';

import { CreatableList } from './creatable-list.client';

export interface TagFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly values: readonly string[];
  readonly onValuesChange: (values: readonly string[]) => void;
  /** Values already in use elsewhere, offered to choose from. */
  readonly suggestions?: readonly string[] | undefined;
  /** What the row that adds the typed text says, e.g. `Add "x"`. */
  readonly createText: (value: string) => string;
  readonly removeText: (value: string) => string;
  /** Said in the list while there is nothing to pick yet: how to add a value. */
  readonly emptyText: string;
  /** Shown in the field while nothing is chosen. */
  readonly placeholder?: string | undefined;
  /** Tidies a typed value before it is kept (case, spacing); `null` refuses it. */
  readonly normalize?: ((value: string) => string | null) | undefined;
  readonly disabled?: boolean | undefined;
}

const FRAME =
  'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-token border border-border-strong bg-surface px-2 py-1 text-sm text-copy ring-offset-surface transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2';

/** The frame around the chips and the input, in the look of the other fields: an error and "off" change it. */
const frameClass = (hasError: boolean, isDisabled: boolean) =>
  cn(
    FRAME,
    hasError && 'border-danger ring-2 ring-danger/30',
    isDisabled && 'cursor-not-allowed opacity-50',
  );

/** The list the input controls: only while it is open and has rows. */
const listOf = ({ isShown, items, listId }: ReturnType<typeof useCreatableChoice>) =>
  isShown && items.length > 0 ? listId : undefined;

/** What a screen reader hears of the input: a combobox over the list, the row highlighted now, and why it is invalid. */
function comboboxAria(
  choice: ReturnType<typeof useCreatableChoice>,
  {
    hasError,
    describedBy,
  }: { readonly hasError: boolean; readonly describedBy: string | undefined },
) {
  const { isShown, highlighted, itemId } = choice;
  return {
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': isShown && highlighted >= 0 ? itemId(highlighted) : undefined,
    'aria-invalid': hasError ? true : undefined,
    'aria-describedby': describedBy,
  };
}

/**
 * A list of short values the person builds one at a time (documents to bring, qualifications), as an
 * ARIA combobox with the values inside the field: the list offers what is in use and adds the typed
 * text as a new value ("Add …"). Enter, a comma or a pick adds, Backspace in the empty field takes the
 * last back, and each kept value has its own remove button, so nothing depends on a pointer.
 */
export function TagField({
  id,
  label,
  hint,
  error,
  values,
  onValuesChange,
  suggestions = [],
  createText,
  removeText,
  emptyText,
  placeholder,
  normalize = trimToNull,
  disabled = false,
}: TagFieldProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const choice = useCreatableChoice({
    draft,
    suggestions,
    taken: values,
    normalize,
    isDisabled: disabled,
    onCommit: (value) => {
      onValuesChange(unique([...values, value]));
      setDraft('');
    },
    onBackspaceEmpty: () => {
      onValuesChange(values.slice(0, -1));
    },
    commitsOnEnter: true,
  });
  const { isShown, items, highlighted, panelId, listId, itemId } = choice;
  useAnchoredPosition(isShown, anchorRef, panelId);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = describedByIds(Boolean(hint) && hintId, Boolean(error) && errorId);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div ref={anchorRef} className={frameClass(Boolean(error), disabled)}>
        {values.length > 0 && (
          <TagChips
            label={label}
            values={values}
            isDisabled={disabled}
            removeText={removeText}
            onRemove={(value) => {
              onValuesChange(values.filter((kept) => kept !== value));
            }}
          />
        )}
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : undefined}
          autoComplete="off"
          role="combobox"
          aria-expanded={choice.isShown}
          aria-controls={listOf(choice)}
          {...comboboxAria(choice, { hasError: Boolean(error), describedBy })}
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(event) => {
            setDraft(event.target.value);
            choice.typed();
          }}
          onFocus={choice.open}
          onClick={choice.open}
          onBlur={choice.close}
          onKeyDown={choice.onKeyDown}
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

interface TagChipsProps {
  readonly label: string;
  readonly values: readonly string[];
  readonly isDisabled: boolean;
  readonly removeText: (value: string) => string;
  readonly onRemove: (value: string) => void;
}

/** The values kept so far, each with a button that takes it away. */
function TagChips({ label, values, isDisabled, removeText, onRemove }: TagChipsProps) {
  return (
    <ul aria-label={label} className="contents">
      {values.map((value) => (
        <li
          key={value}
          className="inline-flex items-center gap-1 rounded-token-sm border border-border bg-canvas py-0.5 pe-0.5 ps-2 text-sm text-copy"
        >
          {value}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={removeText(value)}
            disabled={isDisabled}
            onClick={() => {
              onRemove(value);
            }}
          >
            <Close className="size-3.5" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
