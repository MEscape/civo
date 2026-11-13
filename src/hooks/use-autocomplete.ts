'use client';

import { useId, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { isBlank } from '@lib/utils';

export interface AutocompleteChoice {
  /** What is written into the field when the choice is picked. */
  readonly value: string;
}

interface AutocompleteOptions<T extends AutocompleteChoice> {
  readonly value: string;
  readonly options: readonly T[];
  readonly isSearching: boolean;
  readonly isDisabled: boolean;
  readonly onValueChange: (value: string) => void;
  readonly onPick: ((choice: T) => void) | undefined;
}

/**
 * The behaviour of a combobox that only suggests: the list opens while someone types or focuses the
 * field, arrows move through it, Enter picks, Escape closes, and whatever is typed stays as typed.
 */
export function useAutocomplete<T extends AutocompleteChoice>({
  value,
  options,
  isSearching,
  isDisabled,
  onValueChange,
  onPick,
}: AutocompleteOptions<T>) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const showList = isOpen && !isDisabled && !isBlank(value) && (options.length > 0 || isSearching);

  const choose = (choice: T) => {
    onValueChange(choice.value);
    onPick?.(choice);
    setIsOpen(false);
    setHighlighted(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length > 0) {
        setIsOpen(true);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlighted((current) => (current + step + options.length) % options.length);
      }
    } else if (event.key === 'Enter' && showList && options[highlighted] !== undefined) {
      event.preventDefault();
      choose(options[highlighted]);
    }
  };

  return {
    showList,
    highlighted,
    listId,
    optionId: (index: number) => `${listId}-${String(index)}`,
    choose,
    inputHandlers: {
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        onValueChange(event.target.value);
        setIsOpen(true);
        setHighlighted(-1);
      },
      onFocus: () => {
        setIsOpen(true);
      },
      onBlur: () => {
        setIsOpen(false);
      },
      onKeyDown,
    },
  };
}
