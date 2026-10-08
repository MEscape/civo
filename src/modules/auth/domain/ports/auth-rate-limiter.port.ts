import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AuthRateLimitAction } from '../models/rate-limit';

export interface RateLimitRequest {
  readonly action: AuthRateLimitAction;
  /** What is being throttled, e.g. a normalised email. Adapters must not store it in clear. */
  readonly subject: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export type RateLimitDecision =
  { readonly isAllowed: true } | { readonly isAllowed: false; readonly retryAfterSeconds: number };

/**
 * Throttles unauthenticated operations. Needed because Better Auth's own
 * limiter only sees requests that arrive through its HTTP handler, while
 * Server Actions call `auth.api.*` directly and bypass it.
 *
 * `consume` counts the attempt and decides in one step, so concurrent
 * requests cannot both slip under the limit.
 */
export interface AuthRateLimiter {
  consume(request: RateLimitRequest): AppResultAsync<RateLimitDecision, InfrastructureAppError>;
}
