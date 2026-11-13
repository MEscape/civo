import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for what changes websites, per signed-in person. Creating a website writes in two
 * modules (the website and its home page) and undoes the first write if the second fails, so a
 * script looping on it would churn both; it is a rare act of the platform's administrators, so a
 * handful a minute is ample. Settings and theme edits are single-row writes that a person makes
 * while typing and saving, so their budget is loose and only stops automation. Each fails closed
 * when the limiter's store is down, because what they change is what a release publishes.
 */
export const WEBSITE_RATE_LIMITS = {
  create: {
    id: 'website.create',
    limit: 5,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  update: {
    id: 'website.update',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  updateTheme: {
    id: 'website.update-theme',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
