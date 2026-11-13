import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimiter } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/website-errors';

export type ActorLimitError = RateLimitedAppError | InfrastructureAppError;

/** Who is counted: the person the use case authorized, never anything from the request. */
interface Counted {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
}

/**
 * A pipeline step that spends one attempt of the signed-in person's budget, or fails with the
 * module's own rate-limit error, and passes on what it was given. `whoOf` names the authorized
 * person in what the previous step produced (an `Actor` or a `WebsiteScope`).
 */
export function withinActorLimit<TLoaded>(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicy,
  whoOf: (loaded: TLoaded) => Counted,
): (loaded: TLoaded) => AppResultAsync<TLoaded, ActorLimitError> {
  return (loaded) => {
    const { actorId, tenantId } = whoOf(loaded);
    return deps.rateLimiter
      .enforce({ policy, subject: { kind: 'actor', tenantId, actorId } })
      .map(() => loaded)
      .mapErr(fromRateLimitFailure);
  };
}
