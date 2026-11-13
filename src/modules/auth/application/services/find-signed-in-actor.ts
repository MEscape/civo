import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { Actor } from '../../domain/models/actor';
import type { CurrentActorProvider } from '../../domain/ports/current-actor-provider.port';

/** Who is signed in, or `null` for an anonymous caller. Only a failed lookup is an error. */
export function findSignedInActor(
  currentActor: CurrentActorProvider,
): AppResultAsync<Actor | null, InfrastructureAppError> {
  return currentActor
    .getCurrentActor()
    .map((actor): Actor | null => actor)
    .orElse((error): AppResultAsync<Actor | null, InfrastructureAppError> =>
      error.kind === 'unauthorized' ? okAsync(null) : errAsync(error),
    );
}
