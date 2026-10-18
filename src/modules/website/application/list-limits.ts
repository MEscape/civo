import type { PageLimits } from '@lib/pagination';

/** A page of websites is a grid of cards: a few rows, never more than a screen of them (performance.md: every list is bounded). */
export const WEBSITE_PAGE_LIMITS: PageLimits = { defaultPageSize: 12, maxPageSize: 48 };

/**
 * The websites a platform administrator can pick from in a filter or a menu:
 * only an id and a name each, so a thousand are a few dozen kilobytes. Past
 * it the list says so instead of silently leaving some out.
 */
export const MAX_WEBSITE_OPTIONS = 1000;

/** Someone who belongs to more websites than this is a data error, not a case to serve. */
export const MAX_NAMED_WEBSITES = 50;
