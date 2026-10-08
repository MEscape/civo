import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { trimToNull } from '@lib/utils';

import { MAX_SCANNED_WEBSITES } from '../list-limits';

import type {
  ComponentUsageView,
  FindWebsitesUsingComponentInput,
} from '../contracts/release-views';
import type { ReleaseDependencies } from '../release-dependencies';

type FindUsagesError = AuthorizationError | InfrastructureAppError;

/**
 * Which of the actor's own live websites use a component type, and at
 * which version ("who still needs to migrate off EventsGrid@2?").
 *
 * It reads each live release's own recorded dependencies, never the
 * current registry: a release's dependency record is fixed at publish time
 * and must not drift because the registry moved on.
 */
export class FindWebsitesUsingComponent {
  constructor(private readonly deps: ReleaseDependencies) {}

  execute(
    input: FindWebsitesUsingComponentInput,
  ): AppResultAsync<readonly ComponentUsageView[], FindUsagesError> {
    const componentType = trimToNull(input.componentType);

    return this.deps.authorization
      .requireInTenant('release.read')
      .andThen((actor) =>
        componentType === null
          ? okAsync([])
          : this.deps.releases.listPublishedDependencies(actor.tenantId, MAX_SCANNED_WEBSITES),
      )
      .map((published) =>
        published.flatMap((entry) => {
          const dependency = entry.dependencies.find(
            (candidate) => candidate.type === componentType,
          );
          const matchesVersion =
            input.version === undefined || dependency?.version === input.version;
          if (dependency === undefined || !matchesVersion) {
            return [];
          }
          return [
            {
              websiteId: entry.websiteId,
              releaseId: entry.releaseId,
              componentVersion: dependency.version,
            },
          ];
        }),
      );
  }
}
