import type { ConflictAppError, NotFoundAppError, UnexpectedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseNotFound } from '../../domain/errors/release-errors';
import { parseReleaseId } from '../../domain/models/ids';
import { ensureActivatable } from '../../domain/models/release';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toReleaseSummaryView } from '../release-view-mappers';

import type { Release } from '../../domain/models/release';
import type { ReleaseSummaryView, RollbackReleaseInput } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ReleaseDependencies } from '../release-dependencies';

export type RollbackReleaseError = LoadReleaseWebsiteError | ConflictAppError | UnexpectedAppError;

/**
 * Makes a previously published release live again. Only the pointer moves:
 * the release is never rebuilt or edited, so what goes live is byte for
 * byte what was live before.
 *
 * Loading the target reads and validates its snapshot, which doubles as
 * the integrity check: a corrupted release is refused instead of served.
 */
export class RollbackRelease {
  constructor(private readonly deps: ReleaseDependencies) {}

  execute(input: RollbackReleaseInput): AppResultAsync<ReleaseSummaryView, RollbackReleaseError> {
    const { releases, audit } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, input.websiteId, 'release.rollback').andThen(
      ({ actor, website }) =>
        parseReleaseId(input.releaseId)
          .asyncAndThen((releaseId) => releases.findById(website.id, releaseId))
          .andThen((release): AppResultAsync<Release, NotFoundAppError> =>
            release === null ? errAsync(releaseNotFound()) : okAsync(release),
          )
          .andThen((release) =>
            ensureActivatable(release).asyncAndThen(() =>
              releases.activate({ websiteId: website.id, releaseId: release.id }),
            ),
          )
          .map((activation) => {
            audit.record({
              type: 'release.rolled_back',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: website.id,
              releaseId: activation.release.id,
              releaseNumber: activation.release.releaseNumber,
              previousReleaseId: activation.previousReleaseId,
            });
            return toReleaseSummaryView(activation.release, activation.release.id);
          }),
    );
  }
}
