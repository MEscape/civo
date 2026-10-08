/** The unauthenticated operations that are throttled, per subject. */
export const AUTH_RATE_LIMIT_ACTIONS = ['sign_in', 'sign_up', 'password_reset'] as const;

export type AuthRateLimitAction = (typeof AUTH_RATE_LIMIT_ACTIONS)[number];
