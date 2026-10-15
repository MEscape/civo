'use client';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Icons } from '@components/ui/icons';
import { Input, Label } from '@components/ui/input';

import { cn } from '@lib/utils';

import { buildRows, intentForKey } from './combobox-model';
import { FieldMessage } from './field-message';

import type { ComboboxOption, ComboboxRow as Row } from './combobox-model';

interface ComboboxFieldBase {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Everything the user may choose from; the component filters what is typed. */
  readonly options: readonly ComboboxOption[];
  /** Shown when nothing matches and nothing can be created. */
  readonly emptyText: string;
  /** The row that offers to add what was typed (translated, e.g. `Add "x"`). Setting it allows creating values. */
  readonly createText?: (value: string) => string;
  /** Turns typed text into the value to store, or `null` to refuse it. Defaults to trimming. */
  readonly normalizeCreated?: (raw: string) => string | null;
  /**
   * For options that come from a search: called with what was typed (the owner
   * debounces and cancels), and the options are shown as given, not filtered
   * again here. Without it the options are the complete set and are filtered
   * locally.
   */
  readonly onQueryChange?: (query: string) => void;
  /** Keep what was typed when the field loses focus, instead of dropping it (free-text fields with suggestions). Single selection only. */
  readonly commitOnBlur?: boolean;
  /** Shown instead of the empty-state text while a search is running. */
  readonly loadingText?: string | undefined;
}

export interface MultipleComboboxFieldProps extends ComboboxFieldBase {
  readonly selectionMode: 'multiple';
  readonly values: readonly string[];
  readonly onValuesChange: (values: readonly string[]) => void;
  /** Accessible name of a chip's remove button, e.g. `Remove Contract law`. */
  readonly removeText: (label: string) => string;
}

export interface SingleComboboxFieldProps extends ComboboxFieldBase {
  readonly selectionMode: 'single';
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export type ComboboxFieldProps = MultipleComboboxFieldProps | SingleComboboxFieldProps;

const trimmed = (raw: string): string | null => raw.trim();

function selectedValuesOf(props: ComboboxFieldProps): readonly string[] {
  if (props.selectionMode === 'multiple') {
    return props.values;
  }
  return props.value === '' ? [] : [props.value];
}

interface ChipListProps {
  readonly label: string;
  readonly values: readonly string[];
  readonly labelOf: (value: string) => string;
  readonly removeText: (label: string) => string;
  readonly disabled: boolean;
  readonly onRemove: (value: string) => void;
}

function ChipList({ label, values, labelOf, removeText, disabled, onRemove }: ChipListProps) {
  if (values.length === 0) {
    return null;
  }
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <li
          key={value}
          className="inline-flex items-center gap-1 rounded-token-sm border border-border bg-canvas py-0.5 pl-2 pr-0.5 text-xs text-copy"
        >
          {labelOf(value)}
          <button
            type="button"
            disabled={disabled}
            aria-label={removeText(labelOf(value))}
            className="inline-flex size-5 items-center justify-center rounded-token-sm text-copy-muted hover:bg-border hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              onRemove(value);
            }}
          >
            <Icons.close className="size-3" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ListboxProps {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly Row[];
  readonly activeIndex: number;
  readonly selected: readonly string[];
  readonly isMultiple: boolean;
  readonly emptyText: string;
  readonly onPick: (row: Row) => void;
}

function Listbox({
  id,
  label,
  rows,
  activeIndex,
  selected,
  isMultiple,
  emptyText,
  onPick,
}: ListboxProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      aria-multiselectable={isMultiple || undefined}
      className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-token border border-border bg-surface p-1 shadow-lg"
    >
      {rows.length === 0 && <p className="px-2 py-1.5 text-sm text-copy-muted">{emptyText}</p>}
      {rows.map((row, index) => (
        <div
          key={`${row.isCreate ? 'create' : 'option'}:${row.value}`}
          id={`${id}-${index}`}
          role="option"
          tabIndex={-1}
          aria-selected={selected.includes(row.value)}
          className={cn(
            'cursor-pointer select-none rounded-token-sm px-2 py-1.5 text-sm text-copy',
            index === activeIndex && 'bg-canvas',
            row.isCreate && 'font-medium text-primary-copy',
          )}
          // Mouse down, not click: the input must keep focus or its blur closes the list first.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(row);
          }}
        >
          {row.label}
        </div>
      ))}
    </div>
  );
}

function describedByOf(
  id: string,
  hint: string | undefined,
  error: string | undefined,
): string | undefined {
  const parts = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ];
  const joined = parts.filter((part) => part !== null).join(' ');
  return joined === '' ? undefined : joined;
}

/**
 * A searchable list to pick from, with chips when several values are allowed
 * and an optional "add what I typed" row. It follows the ARIA combobox
 * pattern (the input keeps focus, arrow keys move through the list, Enter picks,
 * Escape closes). The options are the complete authorised set, so filtering
 * them here never hides a match; a list too large to send belongs behind a
 * server-side search instead.
 */
export function ComboboxField(props: ComboboxFieldProps) {
  const { id, label, hint, error, placeholder, options, emptyText } = props;
  const disabled = props.disabled ?? false;
  const normalize = props.normalizeCreated ?? trimmed;
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const isMultiple = props.selectionMode === 'multiple';
  const selected = selectedValuesOf(props);
  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const text = query ?? '';
  const { rows, created } = buildRows({
    options,
    query: text,
    selectedValues: selected,
    hideSelected: isMultiple,
    matchLocally: props.onQueryChange === undefined,
    normalize,
    createText: props.createText,
  });
  // Nothing to pick and nothing typed yet, in a field that lets people add values: no empty box.
  const isIdleCreatable = rows.length === 0 && text === '' && props.createText !== undefined;
  const activeRowIndex = Math.max(0, Math.min(activeIndex, rows.length - 1));
  const active = isOpen ? rows[activeRowIndex] : undefined;

  function close() {
    setIsOpen(false);
    setQuery(null);
    setActiveIndex(0);
  }

  function pick(row: Row) {
    if (props.selectionMode === 'single') {
      props.onValueChange(row.value);
      close();
      return;
    }
    props.onValuesChange(
      props.values.includes(row.value) ? props.values : [...props.values, row.value],
    );
    setQuery('');
    setActiveIndex(0);
  }

  function remove(value: string) {
    if (props.selectionMode === 'multiple') {
      props.onValuesChange(props.values.filter((existing) => existing !== value));
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const intent = intentForKey(event.key, {
      isOpen,
      query: text,
      canCreate: created !== null,
      hasChips: isMultiple && selected.length > 0,
    });
    if (intent.kind === 'ignore') {
      return;
    }
    event.preventDefault();
    switch (intent.kind) {
      case 'move':
        setIsOpen(true);
        setActiveIndex(
          isOpen && rows.length > 0
            ? (activeRowIndex + intent.step + rows.length) % rows.length
            : 0,
        );
        break;
      case 'pick':
        if (active !== undefined) {
          pick(active);
        }
        break;
      case 'create':
        pick({ value: created ?? '', label: created ?? '', isCreate: true });
        break;
      case 'close':
        close();
        break;
      case 'remove-last':
        remove(selected[selected.length - 1] ?? '');
        break;
    }
  }

  const inputValue = query ?? (isMultiple ? '' : labelOf(selected[0] ?? ''));

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {props.selectionMode === 'multiple' && (
        <ChipList
          label={label}
          values={props.values}
          labelOf={labelOf}
          removeText={props.removeText}
          disabled={disabled}
          onRemove={remove}
        />
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active === undefined ? undefined : `${listId}-${activeRowIndex}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByOf(id, hint, error)}
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => {
            setQuery(event.target.value);
            props.onQueryChange?.(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            if (
              props.commitOnBlur === true &&
              props.selectionMode === 'single' &&
              created !== null
            ) {
              props.onValueChange(created);
            }
            close();
          }}
          onKeyDown={handleKeyDown}
        />
        {isOpen && !isIdleCreatable && (
          <Listbox
            id={listId}
            label={label}
            rows={rows}
            activeIndex={activeRowIndex}
            selected={selected}
            isMultiple={isMultiple}
            emptyText={props.loadingText ?? emptyText}
            onPick={pick}
          />
        )}
      </div>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}
