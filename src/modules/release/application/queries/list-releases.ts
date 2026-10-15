import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { RELEASE_HISTORY_PAGE_LIMITS } from '../list-limits';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toReleaseHistoryView } from '../release-view-mappers';

import type { ReleaseHistoryView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ReleaseDependencies } from '../release-dependencies';

/** The page asked for, as the address carries it: untrusted text, resolved here. */
export interface ListReleasesOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}

/** One page of a website's release history, newest first. A page past the end answers the last one. */
export class ListReleases {
  constructor(private readonly deps: ReleaseDependencies) {}

  execute(
    rawWebsiteId: string,
    options: ListReleasesOptions = {},
  ): AppResultAsync<ReleaseHistoryView, LoadReleaseWebsiteError> {
    const requested = resolvePageRequest(options, RELEASE_HISTORY_PAGE_LIMITS);

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read')
      .andThen(({ website }) =>
        loadClampedPage(requested, (request) =>
          this.deps.releases.findHistory(website.id, request),
        ),
      )
      .map(toReleaseHistoryView);
  }
}
