import { okAsync } from '@lib/result';

import type { RateLimitAllowance, RateLimiter, RateLimitRequest } from './rate-limiter';

function allowAll(request: RateLimitRequest): RateLimitAllowance {
  return { limit: request.policy.limit, remaining: null, resetAfterSeconds: null, degraded: false };
}

/**
 * The limiter while `RATE_LIMIT_ENABLED=false`: every attempt is allowed and nothing is counted or
 * validated, so no store is reached. Only the configuration chooses it; a limiter that fails to
 * build never becomes this one.
 */
export const disabledRateLimiter: RateLimiter = {
  enforce: (request) => okAsync(allowAll(request)),
  enforceAll: (requests) => okAsync(requests.map(allowAll)),
};
