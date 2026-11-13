import type { PageLimits } from '@lib/pagination';

/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */

/** A page of the library is a table of thumbnails with a name: a screenful of rows, never more. */
export const MEDIA_PAGE_LIMITS: PageLimits = { defaultPageSize: 12, maxPageSize: 48 };

/**
 * Images a picker offers: the newest of the website, in a small grid. Not truncation to hide: the
 * picker says when the website holds more and points to the library.
 */
export const MEDIA_PICKER_PAGE_SIZE = 24;
