import type { PageLimits } from '@lib/pagination';

/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const RELEASE_HISTORY_PAGE_LIMITS: PageLimits = { defaultPageSize: 10, maxPageSize: 50 };

/** Each row carries the change summary of its plan, so a page costs more than a release row does. */
export const MIGRATION_HISTORY_PAGE_LIMITS: PageLimits = { defaultPageSize: 10, maxPageSize: 50 };

/** Releases and changed pages the publication status previews; the full lists have their own pages. */
export const PUBLICATION_RECENT_RELEASES = 3;
export const PUBLICATION_CHANGE_PREVIEW = 10;

/** Upper bound on live releases read per call; there is no dependency index yet. */
export const MAX_SCANNED_WEBSITES = 500;
