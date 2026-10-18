import type { PageLimits } from '@lib/pagination';

/** A page of a website's pages is a list of rows (performance.md: every list is bounded). */
export const PAGE_LIST_LIMITS: PageLimits = { defaultPageSize: 25, maxPageSize: 100 };

/** Titles looked up at once, by id: a page of the audit log names fewer. */
export const MAX_RESOLVED_PAGE_TITLES = 100;

/** A release reads every page of one website; above this the read is refused, not truncated. */
export const MAX_RELEASE_PAGES = 500;
