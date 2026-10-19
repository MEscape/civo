/** The open platform invitations looked at when deciding whether an administrator address was already mailed: one per configured address, so far fewer. */
export const MAX_BOOTSTRAP_INVITATIONS_SCANNED = 100;

/** Most employees one assignment list offers; a tenant with more narrows the role first. */
export const MAX_PLATFORM_ADMINS_LISTED = 100;

/** The people a platform-wide listing narrows to by website or role before it pages them; a filter that matches more is reported as truncated. */
export const MAX_PLATFORM_FILTERED_PEOPLE = 10_000;

/** The most names one call resolves: a page of a history (an audit page names its actors and the members it concerns), not a roster. */
export const MAX_RESOLVED_NAMES = 100;
