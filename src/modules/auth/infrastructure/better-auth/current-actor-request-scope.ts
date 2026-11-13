import { cache } from 'react';

import { connection } from 'next/server';

import { ResultAsync } from '@lib/result';
import { once } from '@lib/utils';

import type { CurrentActorProvider } from '../../domain/ports/current-actor-provider.port';

/**
 * Resolving the actor costs a session lookup plus a membership query. React's
 * `cache` collapses repeats within ONE server render or action into a
 * single lookup, and never outlives the request, so a role change is still
 * visible on the next request. Do not swap it for a longer-lived cache
 * (caching.md: authorization decisions need an explicit identity boundary).
 */
export function memoizePerRequest(provider: CurrentActorProvider): CurrentActorProvider {
  const resolve = cache(() => provider.getCurrentActor());
  return { getCurrentActor: () => resolve() };
}

/**
 * Knowing the actor is request-time work. A real session lookup reads
 * `headers()`, which keeps everything that depends on the actor out of
 * prerendering; the fixed dev actor reads nothing, so without this a protected
 * page would prerender and run its database queries at build time.
 * The lazy getter keeps construction (including timestamped logging) behind
 * the same request boundary. Construction runs once per wrapper; the actor
 * still resolves afresh for each request.
 */
export function requestScoped(buildProvider: () => CurrentActorProvider): CurrentActorProvider {
  const getProvider = once(buildProvider);
  return {
    getCurrentActor: () =>
      ResultAsync.fromSafePromise(connection()).andThen(() => getProvider().getCurrentActor()),
  };
}
