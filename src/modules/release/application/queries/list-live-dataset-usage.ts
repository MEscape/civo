import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { liveDatasetUsageOf } from '../services/live-dataset-uses';

import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { LiveDatasetUsageView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { DeleteUnusedDataDependencies } from '../release-dependencies';

/**
 * Which pages of the live site show each dataset, so the data screen can say
 * that deleting one would break the public site until the next publish.
 * Empty for a website that was never published.
 */
export class ListLiveDatasetUsage {
  constructor(private readonly deps: DeleteUnusedDataDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<LiveDatasetUsageView, LoadReleaseWebsiteError | ReleaseReadError> {
    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read').andThen(
      ({ website }) =>
        this.deps.releases
          .findPublished(website.id)
          .map((live) => liveDatasetUsageOf(live, this.deps.data)),
    );
  }
}
