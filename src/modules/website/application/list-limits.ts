import type { PageLimits } from '@lib/pagination';

/** A page of websites is a grid of cards: a few rows, never more than a screen of them (performance.md: every list is bounded). */
export const WEBSITE_PAGE_LIMITS: PageLimits = { defaultPageSize: 12, maxPageSize: 48 };
