import type { UnexpectedAppError } from '@lib/errors';
import { combineAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { isUpToDate } from '../../domain/migration/migration-plan';
import { describeDraftChanges } from '../../domain/publishing/draft-changes';
import { PUBLICATION_RECENT_RELEASES } from '../release-limits';
import { toPublicationStatusView } from '../release-view-mappers';
import { findReleaseWebsite } from '../services/find-release-website';
import { planLiveRelease } from '../services/live-release-plan';

import type { MigrationPlan } from '../../domain/migration/migration-plan';
import type { PageTree } from '../../domain/migration/page-tree';
import type { Release } from '../../domain/models/release';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { PublishablePage } from '../../domain/publishing/publishable';
import type { PublicationStatusView } from '../contracts/publication-views';
import type { ReleaseOperationError, PublishReleaseDependencies } from '../release-dependencies';

export type GetPublicationStatusError =
  ReleaseOperationError | ReleaseReadError | UnexpectedAppError;

/**
 * Where a website stands between its pages and the live site: what is live,
 * what publishing now would change, and whether newer components exist. The
 * same reads a publish and a migration check make, but nothing is written
 * and nothing is recorded.
 */
export class GetPublicationStatus {
  constructor(private readonly deps: PublishReleaseDependencies) {}

  execute(rawWebsiteId: string): AppResultAsync<PublicationStatusView, GetPublicationStatusError> {
    const { releases, pages, maps } = this.deps;

    return this.deps.access
      .authorizeWebsite('release.read', rawWebsiteId)
      .andThen(({ websiteId }) => findReleaseWebsite(this.deps.websites, websiteId))
      .andThen((website) =>
        releases.findPublished(website.id).andThen((live) =>
          combineAsync([
            pages.listForRelease(website.id),
            maps.listForRelease(website.id),
          ] as const).andThen(([drafts, savedMaps]) =>
            releases
              .findHistory(website.id, { page: 1, pageSize: PUBLICATION_RECENT_RELEASES })
              .andThen((history) =>
                this.planOf(live)
                  .andThen((plan) =>
                    this.editorTreesFor(plan, drafts).map((editorTrees) => ({ plan, editorTrees })),
                  )
                  .asyncAndThen(({ plan, editorTrees }) =>
                    okAsync(
                      toPublicationStatusView({
                        live,
                        history,
                        changes: describeDraftChanges(live, {
                          website,
                          pages: drafts,
                          maps: savedMaps,
                        }),
                        plan,
                        checkedAt: this.deps.clock.now(),
                        editorPages: drafts,
                        editorTrees,
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

  /** Current instances are needed only when the live release actually has component updates. */
  private editorTreesFor(
    plan: MigrationPlan | null,
    drafts: readonly PublishablePage[],
  ): AppResult<readonly PageTree[], UnexpectedAppError> {
    return plan === null || isUpToDate(plan)
      ? ok([])
      : this.deps.pages.readTrees(drafts.filter((page) => page.status === 'ready'));
  }
}
