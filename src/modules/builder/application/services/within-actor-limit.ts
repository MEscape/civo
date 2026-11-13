import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/builder-errors';

import type { BuilderScope } from '../../domain/ports/builder-access.port';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * A step for an authorized use case's pipeline: spends one attempt of the signed-in person's
 * budget and passes the scope on, or stops with the module's own rate-limit error. The subject
 * is the scope auth authorized, never anything from the request.
 */
export function withinActorLimit(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
): (scope: BuilderScope) => AppResultAsync<BuilderScope, ActorLimitError> {
  return (scope) =>
    deps.rateLimiter
      .enforce({
        policy,
        subject: { kind: 'actor', tenantId: scope.tenantId, actorId: scope.actorId },
      })
      .map(() => scope)
      .mapErr(fromRateLimitFailure);
}
