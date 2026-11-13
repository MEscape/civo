'use client';

import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';

/** One row of the list under a field: a value already in use, or the text typed so far as a new one. */
export interface CreatableItem {
  readonly kind: 'existing' | 'create';
  readonly value: string;
}

export interface CreatableChoiceOptions {
  /** The text typed into the field now. */
  readonly draft: string;
  /** Values already in use elsewhere, offered to choose from. */
  readonly suggestions: readonly string[];
  /** Values the field already holds: they are not offered again, and the typed text is not "new" next to them. */
  readonly taken: readonly string[];
  /** Tidies the typed text into the value it would become (case, spacing); `null` refuses it. */
  readonly normalize: (raw: string) => string | null;
  readonly isDisabled: boolean;
  /** Called with a value chosen from the list or created from the typed text. */
  readonly onCommit: (value: string) => void;
  /** Backspace in an empty field (a list of values): the last one goes. */
  readonly onBackspaceEmpty?: (() => void) | undefined;
  /** Enter with nothing highlighted adds the typed text (a list of values) instead of leaving the key to the form. */
  readonly commitsOnEnter: boolean;
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/**
 * The behaviour of a field that offers what exists and lets the person add what does not: the list
 * opens on focus or typing, shows the matching existing values and, last, the typed text as
 * "add …"; arrows move through it, Enter picks, Escape closes. The list is never empty-handed: a
 * field with nothing to offer yet says how to add the first one (the caller draws that hint).
 */
export function useCreatableChoice({
  draft,
  suggestions,
  taken,
  normalize,
  isDisabled,
  onCommit,
  onBackspaceEmpty,
  commitsOnEnter,
}: CreatableChoiceOptions) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const needle = draft.trim().toLowerCase();
  const existing = suggestions.filter(
    (value) => !taken.some((kept) => same(kept, value)) && value.toLowerCase().includes(needle),
  );
  const created = normalize(draft);
  const isNew =
    created !== null &&
    ![...suggestions, ...taken].some((value) => same(value, created)) &&
    // Typing exactly what a suggestion says is picking it, not making something new.
    !existing.some((value) => same(value, created));
  const items: readonly CreatableItem[] = [
    ...existing.map((value): CreatableItem => ({ kind: 'existing', value })),
    ...(isNew ? [{ kind: 'create', value: created } satisfies CreatableItem] : []),
  ];
  const isShown = isOpen && !isDisabled;

  const choose = (item: CreatableItem) => {
    onCommit(item.value);
    setIsOpen(false);
    setHighlighted(-1);
  };

  const commitTyped = () => {
    if (created !== null) {
      choose({ kind: 'create', value: created });
    }
  };
  const move = (key: 'ArrowDown' | 'ArrowUp') => {
    setIsOpen(true);
    if (items.length > 0) {
      const step = key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => (current + step + items.length) % items.length);
    }
  };
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    const picked = isShown ? items[highlighted] : undefined;
    if (picked !== undefined) {
      event.preventDefault();
      choose(picked);
    } else if (commitsOnEnter) {
      event.preventDefault();
      commitTyped();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if (key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      move(key);
    } else if (key === 'Enter') {
      onEnter(event);
    } else if (key === ',' && commitsOnEnter) {
      event.preventDefault();
      commitTyped();
    } else if (key === 'Backspace' && draft === '') {
      onBackspaceEmpty?.();
    }
  };

  return {
    isShown,
    items,
    highlighted,
    listId,
    panelId: `${listId}-panel`,
    itemId: (index: number) => `${listId}-${String(index)}`,
    choose,
    open: () => {
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
      setHighlighted(-1);
    },
    /** Typing shows the list again and forgets which row was highlighted. */
    typed: () => {
      setIsOpen(true);
      setHighlighted(-1);
    },
    onKeyDown,
  };
}
