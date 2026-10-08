/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_HISTORY_LIMIT = 50;
export const MIN_HISTORY_LIMIT = 1;
export const MAX_HISTORY_LIMIT = 100;

/** Upper bound on live releases read per call; there is no dependency index yet. */
export const MAX_SCANNED_WEBSITES = 500;

export const DEFAULT_MIGRATION_LIST_LIMIT = 50;
export const MIN_MIGRATION_LIST_LIMIT = 1;
export const MAX_MIGRATION_LIST_LIMIT = 100;
