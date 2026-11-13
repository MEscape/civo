import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for what costs the store or the database something on every run, per signed-in person.
 * A person may pick several images at once and each upload takes two calls, so a minute allows
 * a full batch yet stops a script from flooding the store. Deleting is rarer and rewrites two
 * systems, so it gets half. Every policy fails closed when the limiter's store is down, because
 * each one reaches the object store or issues a credential for a file. Listing is not limited:
 * it is one bounded page.
 */
export const MEDIA_RATE_LIMITS = {
  requestUpload: {
    id: 'media.request-upload',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Reads the stored object's header and first bytes to verify the file. */
  completeUpload: {
    id: 'media.complete-upload',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Signs a bearer link to a private file. */
  readUrl: {
    id: 'media.read-url',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  deleteAsset: {
    id: 'media.delete-asset',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
