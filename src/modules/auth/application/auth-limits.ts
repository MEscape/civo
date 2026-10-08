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
