/** Every list and every range is bounded (performance.md). Raise a limit deliberately, never by removing it. */

/** How long a slot stays reserved while the visitor fills in the form. */
export const HOLD_MINUTES = 10;
/** Open bookings and holds one e-mail address may have per website. */
export const MAX_LIVE_BOOKINGS_PER_EMAIL = 5;
/** Unexpired holds per website: a cap on what an anonymous visitor can reserve and abandon. */
export const MAX_LIVE_HOLDS_PER_WEBSITE = 200;

/** Resources read to decide what is free in one query (those that can serve its location); more is refused, never cut. */
export const MAX_RESOURCES_PER_WEBSITE = 500;
/** Bookings read to decide what is free in one query. A busy site stays far below this. */
export const MAX_BLOCKING_BOOKINGS_PER_QUERY = 5000;

/** The longest span (in days) one availability query may cover. */
export const MAX_AVAILABILITY_RANGE_DAYS = 62;
/** The start times one availability answer carries; a longer list says it was cut. */
export const MAX_SLOTS_PER_QUERY = 2000;

/** Pages of the manager's booking list. */
export const BOOKING_PAGE_LIMITS = { defaultPageSize: 25, maxPageSize: 100 } as const;
/** The longest span (in days) the manager's list or an employee's own bookings may cover. */
export const MAX_LIST_RANGE_DAYS = 366;
/** Bookings an employee sees at once as theirs. */
export const MAX_OWN_BOOKINGS = 200;
/** Open bookings offered to an employee at once. */
export const MAX_OPEN_BOOKINGS = 100;

/** A change that finds its booking changed meanwhile reads it again and decides anew this many times. */
export const MAX_STALE_RETRIES = 2;

/** Pages of the list of services (a page is a few categories) and of the services that can be adopted. */
export const SERVICE_PAGE_LIMITS = { defaultPageSize: 5, maxPageSize: 20 } as const;
export const ADOPTABLE_PAGE_LIMITS = { defaultPageSize: 10, maxPageSize: 50 } as const;
/** Locations whose names one answer about services reads. */
export const MAX_LOCATIONS_NAMED = 500;

/** Pages of the list of locations. */
export const LOCATION_PAGE_LIMITS = { defaultPageSize: 25, maxPageSize: 100 } as const;
/** The resources list of a location: each row carries today's use, so a page is short. */
export const RESOURCE_PAGE_LIMITS = { defaultPageSize: 10, maxPageSize: 50 } as const;
/** How far ahead a change of opening hours looks for the bookings it would leave outside, in days. */
export const IMPACT_HORIZON_DAYS = 366;
/** Bookings one impact answer carries; one more than this in the range makes the answer incomplete. */
export const MAX_IMPACT_BOOKINGS = 500;
/** How far ahead "bookings that have not started yet" counts, in days (about ten years). */
export const FUTURE_BOOKINGS_DAYS = 3660;
/** Services, and locations, one public booking page offers at most; a municipality has far fewer. */
export const MAX_CATALOG_ENTRIES = 500;

/** The most days a manager's calendar shows at once: six weeks, a month grid. */
export const MAX_CALENDAR_DAYS = 42;

/** The most bookings a calendar draws; a range with more says so instead of drawing part of it. */
export const MAX_CALENDAR_BOOKINGS = 2000;

/** The most services a list of bookings is labelled with. */
export const MAX_SERVICES_NAMED = 500;

/** Bounds of the employee's own area (performance.md: every list is bounded). */

/** Services an employee may prefer. */
export const MAX_PREFERRED_SERVICES = 500;
/** Services offered to choose from on the preferences page, per location read. */
export const MAX_SERVICES_PER_LOCATION = 500;
/** Bookings on one day of an employee's plan. */
export const MAX_DAY_PLAN_BOOKINGS = 100;
/** Pages of the inbox. */
export const MESSAGE_PAGE_LIMITS = { defaultPageSize: 20, maxPageSize: 50 } as const;
