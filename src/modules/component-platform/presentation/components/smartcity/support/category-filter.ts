const ALL_CATEGORIES = 'all';

/** Maps the editor's "all" choice to "no filter" for `loadContent`. */
export function categoryFilter(value: string): string | undefined {
  return value === ALL_CATEGORIES || value === '' ? undefined : value;
}
