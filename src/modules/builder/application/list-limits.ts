/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_PAGE_LIST_LIMIT = 50;
export const MIN_PAGE_LIST_LIMIT = 1;
export const MAX_PAGE_LIST_LIMIT = 100;

/** A release reads every page of one website; above this the read is refused, not truncated. */
export const MAX_RELEASE_PAGES = 500;
