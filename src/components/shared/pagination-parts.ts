/** Pages to show: the first, the last and the neighbours of the current one; `null` is a gap. */
export function visiblePages(page: number, pageCount: number): ReadonlyArray<number | null> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((candidate) => candidate >= 1 && candidate <= pageCount);
  pages.sort((a, b) => a - b);

  const items: Array<number | null> = [];
  pages.forEach((candidate, index) => {
    const before = pages[index - 1];
    if (before !== undefined && candidate - before > 1) {
      items.push(null);
    }
    items.push(candidate);
  });
  return items;
}

/** The look of one step or page of the pager, shared by the pager of addresses and the one of a form's own list. */
export const PAGER_ITEM =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-token border border-border px-3 text-sm';
export const PAGER_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
