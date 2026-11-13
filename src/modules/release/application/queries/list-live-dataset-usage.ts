import type { AppResultAsync } from '@lib/result';

import { liveDatasetUsageOf } from '../services/live-dataset-uses';

import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { LiveDatasetUsageView } from '../contracts/usage-views';
import type { ReleaseOperationError, DeleteUnusedDataDependencies } from '../release-dependencies';

/**
 * Which pages of the live site show each dataset, so the data screen can say
 * that deleting one would break the public site until the next publish.
 * Empty for a website that was never published.
 */
export class ListLiveDatasetUsage {
  constructor(private readonly deps: DeleteUnusedDataDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<LiveDatasetUsageView, ReleaseOperationError | ReleaseReadError> {
    return this.deps.access
      .authorizeWebsite('release.read', rawWebsiteId)
      .andThen(({ websiteId }) =>
        this.deps.releases
          .findPublished(websiteId)
          .map((live) => liveDatasetUsageOf(live, this.deps)),
      );
  }
}
