import type { PageLimits } from '@lib/pagination';

/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const MAX_SOURCES_PER_WEBSITE = 100;
export const MAX_DATASETS_PER_SOURCE = 200;
export const MAX_COMPATIBLE_DATASETS = 200;

/** Names looked up at once, by id, per kind: a page of the audit log names fewer. */
export const MAX_RESOLVED_NAMES = 100;

/** The data sources screen: each source is a card with its datasets, so a page holds few. */
export const DATA_SOURCE_PAGE_LIMITS: PageLimits = { defaultPageSize: 10, maxPageSize: 50 };
