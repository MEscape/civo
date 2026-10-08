import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { pageLimitExceeded } from '../../domain/errors/builder-errors';
import { parseWebsiteId } from '../../domain/models/ids';
import { MAX_RELEASE_PAGES } from '../list-limits';
import { toReleasePageView } from '../page-view-mappers';

import type { ReleasePage } from '../../domain/models/release-page';
import type { ReleasePageView } from '../contracts/page-views';
import type { PageReaderDependencies } from '../page-dependencies';

export type ListPagesForReleaseError =
  ValidationAppError | ConflictAppError | InfrastructureAppError;

/**
 * Every page of a website with its latest saved configuration, for a
 * trusted publisher. Intentionally has no actor: the publisher authorizes
 * the release itself and passes a website id it resolved from a STORED
 * record, exactly like `CreateSystemPage` takes its tenant. A damaged page
 * is reported per page (`config_invalid`) so one bad page cannot hide the
 * others; a website over the bound is refused rather than silently cut
 * short, because a release missing pages is worse than no release.
 *
 * @authorization system Called by the release module, which authorizes the release and passes a website id read from a stored record.
 */
export class ListPagesForRelease {
  constructor(private readonly deps: PageReaderDependencies) {}

  execute(websiteId: string): AppResultAsync<readonly ReleasePageView[], ListPagesForReleaseError> {
    return parseWebsiteId(websiteId)
      .asyncAndThen((id) =>
        // One extra row proves the bound was exceeded without counting separately.
        this.deps.pages.listReleasePages(id, MAX_RELEASE_PAGES + 1),
      )
      .andThen(
        (
          pages: readonly ReleasePage[],
        ): AppResultAsync<readonly ReleasePage[], ConflictAppError> =>
          pages.length > MAX_RELEASE_PAGES ? errAsync(pageLimitExceeded()) : okAsync(pages),
      )
      .map((pages) => pages.map(toReleasePageView));
  }
}
