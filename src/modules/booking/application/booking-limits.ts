/** Every list and every range is bounded (performance.md). Raise a limit deliberately, never by removing it. */

export const MAX_LOCATIONS_PER_WEBSITE = 100;
export const MAX_RESOURCES_PER_WEBSITE = 500;
export const MAX_SERVICES_PER_WEBSITE = 200;

/** Employees whose hours one change may set at once: "the same hours for everyone" in one step. */
export const MAX_TEAM_HOURS_BATCH = 100;

/** Bookings read to decide what is free in one availability query. A busy site stays far below this. */
export const MAX_BLOCKING_BOOKINGS_PER_QUERY = 5000;
/** Events the operations calendar shows for one visible range. */
export const MAX_CALENDAR_BOOKINGS_PER_QUERY = 2000;

/** The website overview looks this many days ahead and lists the next few appointments. */
export const BOOKING_SUMMARY_DAYS = 7;
export const BOOKING_SUMMARY_NEXT = 5;

/** The longest span (in days) one availability or calendar request may cover. */
export const MAX_AVAILABILITY_RANGE_DAYS = 62;
export const MAX_CALENDAR_RANGE_DAYS = 42;

/** How many alternative times are offered when the chosen one is gone. */
export const DEFAULT_ALTERNATIVE_COUNT = 5;
export const MAX_ALTERNATIVE_COUNT = 10;
/** How far (in days, each way) alternatives are searched. */
export const ALTERNATIVE_SEARCH_DAYS = 7;

/** Address search for a location being edited: the shortest query worth a paid request, the longest accepted, and the suggestions returned. */
export const ADDRESS_SEARCH_LIMITS = { queryMin: 3, queryMax: 120, suggestions: 6 } as const;

/** How long a slot stays reserved while the visitor fills in the form. */
export const HOLD_MINUTES = 10;
/** Open bookings and holds one e-mail address may have per website. */
export const MAX_LIVE_BOOKINGS_PER_EMAIL = 5;
/** Unexpired holds per website: a cap on what an anonymous visitor can reserve and abandon. */
export const MAX_LIVE_HOLDS_PER_WEBSITE = 200;
/** Expired holds released by one maintenance run. */
export const MAX_RELEASED_HOLDS_PER_RUN = 500;
