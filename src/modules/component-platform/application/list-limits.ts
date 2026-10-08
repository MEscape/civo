/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_CONTENT_LIST_LIMIT = 12;
export const MIN_CONTENT_LIST_LIMIT = 1;
/**
 * A map shows every feature of its dataset, so the ceiling matches the
 * data-sources mapping cap (1000 records per dataset) instead of the card
 * grids' small lists. Components still ask for their own, smaller limit.
 */
export const MAX_CONTENT_LIST_LIMIT = 1_000;
