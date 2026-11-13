import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/booking-errors';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/**
 * Spends one attempt of the signed-in person's budget and passes the actor on, or stops with the
 * module's own rate-limit error. The subject is the actor the use case authorized, never anything
 * from the request.
 */
export function withinActorLimit(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
  actor: Actor,
): AppResultAsync<Actor, ActorLimitError> {
  return deps.rateLimiter
    .enforce({ policy, subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id } })
    .map(() => actor)
    .mapErr(fromRateLimitFailure);
}
