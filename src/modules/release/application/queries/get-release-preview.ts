import type { NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseNotFound } from '../../domain/errors/release-errors';
import { toReleaseId } from '../../domain/models/ids';
import { describePreviewFidelity } from '../../domain/models/preview-fidelity';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toReleasePreviewView } from '../release-view-mappers';

import type { Release } from '../../domain/models/release';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { ReleasePreviewView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ReleasePreviewDependencies } from '../release-dependencies';

export type GetReleasePreviewError = LoadReleaseWebsiteError | ReleaseReadError | NotFoundAppError;

/**
 * What one release of a website froze, for looking at an earlier state: its
 * pages, where it sits in the history (live or not, the releases next to it)
 * and how faithfully today's components can draw it. The release is found
 * through the authorized website, so another website's release id behaves
 * exactly like one that does not exist.
 */
export class GetReleasePreview {
  constructor(private readonly deps: ReleasePreviewDependencies) {}

  execute(
    rawWebsiteId: string,
    rawReleaseId: string,
  ): AppResultAsync<ReleasePreviewView, GetReleasePreviewError> {
    const { releases, components } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read').andThen(
      ({ website }) =>
        releases
          .findById(website.id, toReleaseId(rawReleaseId))
          .andThen((release): AppResultAsync<Release, NotFoundAppError> =>
            release === null ? errAsync(releaseNotFound()) : okAsync(release),
          )
          .andThen((release) =>
            releases.findNeighbours(website.id, release.releaseNumber).map((neighbours) =>
              toReleasePreviewView({
                release,
                neighbours,
                fidelity: describePreviewFidelity(release.snapshot.dependencies, components),
              }),
            ),
          ),
    );
  }
}
