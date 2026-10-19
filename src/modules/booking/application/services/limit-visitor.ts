import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy } from '@lib/rate-limit';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/booking-errors';

import { resolvePublicScope } from './public-scope';

import type { PublicBookingDependencies } from '../booking-dependencies';
import type { PublicScope, PublicScopeError } from './public-scope';

export type VisitorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * Spends one request of the visitor's budget and stops there when it is used up. The visitor is
 * identified by the address the platform reports, never by anything they typed.
 */
function limitVisitor(
  deps: Pick<PublicBookingDependencies, 'rateLimiter' | 'clientAddress'>,
  policy: RateLimitPolicy,
): AppResultAsync<void, VisitorLimitError> {
  return ResultAsync.fromSafePromise(deps.clientAddress.current())
    .andThen((client) => deps.rateLimiter.enforce({ policy, subject: client }))
    .map(() => undefined)
    .mapErr(fromRateLimitFailure);
}

/**
 * `resolvePublicScope` for a use case a visitor can repeat: the visitor's budget is spent first,
 * before the request is looked at, so a flood costs the system as little as possible.
 */
export function resolveScopeWithinBudget(
  deps: PublicBookingDependencies,
  policy: RateLimitPolicy,
  websiteId: string,
): AppResultAsync<PublicScope, PublicScopeError | VisitorLimitError> {
  return limitVisitor(deps, policy).andThen(() => resolvePublicScope(deps, websiteId));
}
