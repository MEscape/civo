import type { AuthRateLimitAction } from '../domain/models/rate-limit';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const SECONDS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE;

const SIGN_IN_WINDOW_MINUTES = 15;

/**
 * Attempts allowed per subject (a normalised email) per window. Keyed by
 * subject, not by client address: addresses behind a proxy are spoofable
 * here, so per-IP throttling belongs at the edge. The trade-off is that a
 * stranger can lock one address out of sign-in for the rest of a window,
 * which is why the sign-in window is short.
 */
export const AUTH_RATE_LIMITS = {
  sign_in: { limit: 10, windowSeconds: SIGN_IN_WINDOW_MINUTES * SECONDS_PER_MINUTE },
  sign_up: { limit: 5, windowSeconds: SECONDS_PER_HOUR },
  password_reset: { limit: 5, windowSeconds: SECONDS_PER_HOUR },
} as const satisfies Record<
  AuthRateLimitAction,
  { readonly limit: number; readonly windowSeconds: number }
>;

/** The open platform invitations looked at when deciding whether an administrator address was already mailed: one per configured address, so far fewer. */
export const MAX_BOOTSTRAP_INVITATIONS_SCANNED = 100;

/** Most employees one assignment list offers; a tenant with more narrows the role first. */
export const MAX_PLATFORM_ADMINS_LISTED = 100;

/** The people a platform-wide listing narrows to by website or role before it pages them; a filter that matches more is reported as truncated. */
export const MAX_PLATFORM_FILTERED_PEOPLE = 10_000;

/** The most names one call resolves: a page of a history (an audit page names its actors and the members it concerns), not a roster. */
export const MAX_RESOLVED_NAMES = 100;
