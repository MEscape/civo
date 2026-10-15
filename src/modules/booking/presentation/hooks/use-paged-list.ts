import { useState } from 'react';

/** How many entries of a long list show at first and with each "show more". */
export const LIST_PAGE_SIZE = 8;

export interface PagedList<T> {
  readonly query: string;
  readonly setQuery: (next: string) => void;
  /** Whether the list is long enough to be searched. */
  readonly isSearchable: boolean;
  /** The entries to draw now. */
  readonly shown: readonly T[];
  /** How many entries match the search but are not drawn yet. */
  readonly hiddenCount: number;
  /** True when a search matched nothing in a list that has entries. */
  readonly hasNoMatch: boolean;
  readonly showMore: () => void;
}

function matches(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

/**
 * A long list shown a page at a time and searchable by name, so a website with
 * many services, rooms or employees stays usable. An entry that needs
 * attention (`isPinned`) is never left behind "show more".
 */
export function usePagedList<T>(
  items: readonly T[],
  options: { readonly label: (item: T) => string; readonly isPinned?: (item: T) => boolean },
): PagedList<T> {
  const { label, isPinned = () => false } = options;
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);

  const found = items.filter((item) => matches(label(item), query));
  const shown = found.filter((item, position) => position < visible || isPinned(item));

  return {
    query,
    setQuery,
    isSearchable: items.length > LIST_PAGE_SIZE,
    shown,
    hiddenCount: found.length - shown.length,
    hasNoMatch: items.length > 0 && found.length === 0,
    showMore: () => {
      setVisible((current) => current + LIST_PAGE_SIZE);
    },
  };
}
