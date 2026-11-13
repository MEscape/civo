import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/media-errors';

import type { MediaScope } from '../../domain/ports/media-access.port';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * Spends one attempt of the signed-in person's budget, or fails with the module's own rate-limit
 * error. The subject is the authorized scope the use case got from auth, never anything from the
 * request.
 */
export function withinActorLimit(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
): (scope: MediaScope) => AppResultAsync<MediaScope, ActorLimitError> {
  return (scope) =>
    deps.rateLimiter
      .enforce({
        policy,
        subject: { kind: 'actor', tenantId: scope.tenantId, actorId: scope.actorId },
      })
      .map(() => scope)
      .mapErr(fromRateLimitFailure);
}
