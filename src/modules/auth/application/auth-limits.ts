/** The people a platform-wide listing narrows to by website or role before it pages them; a filter that matches more is reported as truncated. */
export const MAX_PLATFORM_FILTERED_PEOPLE = 10_000;

/** The most names one call resolves: a page of a history (an audit page names its actors and the members it concerns), not a roster. */
export const MAX_RESOLVED_NAMES = 100;

/** The websites one selector names, or the managed websites one person's scope lists; a bigger set is reported as truncated. */
export const MAX_WEBSITE_OPTIONS = 1_000;

/** The platform administrators one listing reads; a bigger set is reported as truncated. */
export const MAX_PLATFORM_ADMINS_LISTED = 500;

/** The employees one team listing names (one directory page). */
export const MAX_EMPLOYEES_LISTED = 100;
