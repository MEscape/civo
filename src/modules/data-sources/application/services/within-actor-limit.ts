import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/data-source-errors';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * A step for an authorized use case's pipeline: spends one attempt of the signed-in person's
 * budget and passes what was loaded on, or stops with the module's own rate-limit error. The
 * subject is the actor the use case authorized, never anything from the request.
 */
export function withinActorLimit<TLoaded extends { readonly actor: Actor }>(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
): (loaded: TLoaded) => AppResultAsync<TLoaded, ActorLimitError> {
  return (loaded) =>
    deps.rateLimiter
      .enforce({
        policy,
        subject: { kind: 'actor', tenantId: loaded.actor.tenantId, actorId: loaded.actor.id },
      })
      .map(() => loaded)
      .mapErr(fromRateLimitFailure);
}
