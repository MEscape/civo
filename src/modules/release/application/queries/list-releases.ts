import type { AppResultAsync } from '@lib/result';
import { clamp } from '@lib/utils';

import { DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT, MIN_HISTORY_LIMIT } from '../list-limits';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toReleaseHistoryView } from '../release-view-mappers';

import type { ReleaseHistoryView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ReleaseDependencies } from '../release-dependencies';

export interface ListReleasesOptions {
  readonly limit?: number;
}

/** A website's release history, newest first. Always bounded. */
export class ListReleases {
  constructor(private readonly deps: ReleaseDependencies) {}

  execute(
    rawWebsiteId: string,
    options: ListReleasesOptions = {},
  ): AppResultAsync<ReleaseHistoryView, LoadReleaseWebsiteError> {
    const requested =
      options.limit !== undefined && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_HISTORY_LIMIT;
    const limit = clamp(requested, MIN_HISTORY_LIMIT, MAX_HISTORY_LIMIT);

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read')
      .andThen(({ website }) => this.deps.releases.findHistory(website.id, limit))
      .map(toReleaseHistoryView);
  }
}
