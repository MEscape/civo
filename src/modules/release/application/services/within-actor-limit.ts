import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/release-errors';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * Spends one attempt of the signed-in person's budget, or fails with the module's own rate-limit
 * error. The subject is the actor the use case authorized, never anything from the request.
 */
export function limitActor(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
  actor: Actor,
): AppResultAsync<Actor, ActorLimitError> {
  return deps.rateLimiter
    .enforce({ policy, subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id } })
    .map(() => actor)
    .mapErr(fromRateLimitFailure);
}

/** `limitActor` as a step of a pipeline that loaded `{ actor, … }`: passes what was loaded on. */
export function withinActorLimit<TLoaded extends { readonly actor: Actor }>(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
): (loaded: TLoaded) => AppResultAsync<TLoaded, ActorLimitError> {
  return (loaded) => limitActor(deps, policy, loaded.actor).map(() => loaded);
}
