import type { UnexpectedAppError } from '@lib/errors';
import { ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { describeDraftChanges } from '../../domain/models/draft-changes';
import { PUBLICATION_RECENT_RELEASES } from '../list-limits';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toPublicationStatusView } from '../release-view-mappers';
import { planLiveRelease } from '../services/live-release-plan';

import type { MigrationPlan } from '../../domain/models/migration-plan';
import type { Release } from '../../domain/models/release';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { PublicationStatusView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { PublishReleaseDependencies } from '../release-dependencies';

export type GetPublicationStatusError =
  LoadReleaseWebsiteError | ReleaseReadError | UnexpectedAppError;

/**
 * Where a website stands between its pages and the live site: what is live,
 * what publishing now would change, and whether newer components exist. The
 * same reads a publish and a migration check make, but nothing is written
 * and nothing is recorded.
 */
export class GetPublicationStatus {
  constructor(private readonly deps: PublishReleaseDependencies) {}

  execute(rawWebsiteId: string): AppResultAsync<PublicationStatusView, GetPublicationStatusError> {
    const { releases, pages } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read').andThen(
      ({ website }) =>
        releases.findPublished(website.id).andThen((live) =>
          pages.listForRelease(website.id).andThen((drafts) =>
            releases
              .findHistory(website.id, { page: 1, pageSize: PUBLICATION_RECENT_RELEASES })
              .andThen((history) =>
                this.planOf(live).asyncAndThen((plan) =>
                  okAsync(
                    toPublicationStatusView({
                      live,
                      history,
                      changes: describeDraftChanges(live, website, drafts),
                      plan,
                      checkedAt: this.deps.clock.now(),
                    }),
                  ),
                ),
              ),
          ),
        ),
    );
  }

  private planOf(live: Release | null): AppResult<MigrationPlan | null, UnexpectedAppError> {
    return live === null ? ok(null) : planLiveRelease(this.deps, live).map(({ plan }) => plan);
  }
}
