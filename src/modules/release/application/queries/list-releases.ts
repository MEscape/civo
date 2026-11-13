import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { RELEASE_HISTORY_PAGE_LIMITS } from '../release-limits';
import { toReleaseHistoryView } from '../release-view-mappers';

import type { HistoryPageOptions } from '../contracts/release-inputs';
import type { ReleaseHistoryView } from '../contracts/release-views';
import type { ReleaseOperationError, ReleaseDependencies } from '../release-dependencies';

/** One page of a website's release history, newest first. A page past the end answers the last one. */
export class ListReleases {
  constructor(private readonly deps: ReleaseDependencies) {}

  execute(
    rawWebsiteId: string,
    options: HistoryPageOptions = {},
  ): AppResultAsync<ReleaseHistoryView, ReleaseOperationError> {
    const requested = resolvePageRequest(options, RELEASE_HISTORY_PAGE_LIMITS);

    return this.deps.access
      .authorizeWebsite('release.read', rawWebsiteId)
      .andThen(({ websiteId }) =>
        loadClampedPage(requested, (request) => this.deps.releases.findHistory(websiteId, request)),
      )
      .map(toReleaseHistoryView);
  }
}
