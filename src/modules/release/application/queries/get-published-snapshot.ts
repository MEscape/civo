import type { InfrastructureAppError, NotFoundAppError, UnexpectedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseNotPublished } from '../../domain/errors/release-errors';
import { parseWebsiteId } from '../../domain/models/ids';
import { toPublishedSnapshotView } from '../release-view-mappers';

import type { Release } from '../../domain/models/release';
import type { PublishedSnapshotView } from '../contracts/release-views';
import type { PublicReleaseDependencies } from '../release-dependencies';

/**
 * Serves the public site, so it is intentionally unauthenticated, and it
 * returns the narrow `PublishedSnapshotView`. It resolves ONLY through the
 * live release pointer, never through draft pages, and fails closed for a
 * website that was never published. A malformed id is just "not
 * published": the public surface does not explain its own id format.
 *
 * @authorization public Serves the published site, which anyone may read; it resolves only the live release.
 */
export class GetPublishedSnapshot {
  constructor(private readonly deps: PublicReleaseDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    PublishedSnapshotView,
    NotFoundAppError | InfrastructureAppError | UnexpectedAppError
  > {
    const websiteId = parseWebsiteId(rawWebsiteId);
    if (websiteId.isErr()) {
      return errAsync(releaseNotPublished());
    }

    return this.deps.releases
      .findPublished(websiteId.value)
      .andThen((release): AppResultAsync<Release, NotFoundAppError> =>
        release === null ? errAsync(releaseNotPublished()) : okAsync(release),
      )
      .map(toPublishedSnapshotView);
  }
}
