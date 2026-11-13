'use client';

import { Plus } from '@components/icons/icons';

import { cn } from '@lib/utils';

import type { CreatableItem } from '../../hooks/use-creatable-choice';

export interface CreatableListProps {
  readonly panelId: string;
  readonly listId: string;
  readonly itemId: (index: number) => string;
  /** The list's accessible name: the field's label. */
  readonly label: string;
  readonly items: readonly CreatableItem[];
  readonly highlighted: number;
  /** What the row that makes a new value says for the text typed, e.g. `Add "x"`. */
  readonly createText: (value: string) => string;
  /** Said while there is nothing to pick yet: how to add the first value. */
  readonly emptyText: string;
  readonly onChoose: (item: CreatableItem) => void;
}

/**
 * The list under a `SuggestField` or `TagField`: the values in use, then the typed text as a new one.
 * Positioned against the field by `useAnchoredPosition` (it must not be cut off by the card the form
 * sits in), and as wide as the field.
 */
export function CreatableList({
  panelId,
  listId,
  itemId,
  label,
  items,
  highlighted,
  createText,
  emptyText,
  onChoose,
}: CreatableListProps) {
  return (
    <div
      id={panelId}
      data-width="anchor"
      className="fixed start-0 top-0 z-50 overflow-hidden rounded-token border border-border bg-surface shadow-md"
    >
      {items.length > 0 ? (
        <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-auto py-1">
          {items.map((item, index) => (
            <div
              key={`${item.kind}-${item.value}`}
              id={itemId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === highlighted}
              // Picked before the input loses focus, or the list would close under the click.
              onMouseDown={(event) => {
                event.preventDefault();
                onChoose(item);
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-copy hover:bg-primary/10',
                item.kind === 'create' && 'font-medium text-primary-copy',
                index === highlighted && 'bg-primary/10',
              )}
            >
              {item.kind === 'create' && <Plus className="size-4 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 truncate">
                {item.kind === 'create' ? createText(item.value) : item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p role="status" className="px-3 py-2 text-sm text-copy-muted">
          {emptyText}
        </p>
      )}
    </div>
  );
}
