import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { combineAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { pick } from '@lib/utils';

import { describeDraftChanges } from '../../domain/publishing/draft-changes';
import { assembleReleaseSnapshot } from '../../domain/publishing/release-assembly';
import { normalizeReleaseNote } from '../../domain/publishing/release-changes';
import { RELEASE_RATE_LIMITS } from '../rate-limits';
import { toReleaseSummaryView } from '../release-view-mappers';
import { findReleaseWebsite } from '../services/find-release-website';
import { withinActorLimit } from '../services/within-actor-limit';

import type { PublishableWebsite } from '../../domain/publishing/publishable';
import type { PublishReleaseInput } from '../contracts/release-inputs';
import type { ReleaseSummaryView } from '../contracts/release-views';
import type { ReleaseOperationError, PublishReleaseDependencies } from '../release-dependencies';
import type { ActorLimitError } from '../services/within-actor-limit';

type PublishFailure = ValidationAppError | ConflictAppError | InfrastructureAppError;

export type PublishReleaseError = ReleaseOperationError | ConflictAppError | ActorLimitError;

/**
 * Builds an immutable release from the website's current pages and makes
 * it the live one. This is the ONLY path that turns draft state into
 * something the public site renders; saving a page never does.
 *
 * Every page is validated and every component's contract checked before
 * anything is written, and the write itself is one transaction, so a
 * failed publish leaves the live release exactly as it was.
 */
export class PublishRelease {
  constructor(private readonly deps: PublishReleaseDependencies) {}

  execute(input: PublishReleaseInput): AppResultAsync<ReleaseSummaryView, PublishReleaseError> {
    const { pages, maps, components, releases, audit, clock } = this.deps;

    return this.deps.access
      .authorizeWebsite('release.publish', input.websiteId)
      .andThen(withinActorLimit(this.deps, RELEASE_RATE_LIMITS.publish))
      .andThen((scope) =>
        findReleaseWebsite(this.deps.websites, scope.websiteId).map((website) => ({
          ...scope,
          website,
        })),
      )
      .andThen(({ actor, website }) =>
        combineAsync([pages.listForRelease(website.id), maps.listForRelease(website.id)] as const)
          .andThen(([publishable, savedMaps]) =>
            // The live release is read only to say what changed; one that cannot be read must
            // not stop the fresh release that replaces it, so it is compared against as absent.
            releases
              .findPublished(website.id)
              .orElse(() => okAsync(null))
              .andThen((live) =>
                assembleReleaseSnapshot({
                  website,
                  pages: publishable,
                  maps: savedMaps,
                  resolveComponent: (type) => components.resolve(type),
                }).asyncAndThen((snapshot) =>
                  releases.publish({
                    websiteId: website.id,
                    snapshot,
                    note: normalizeReleaseNote(input.note),
                    publishedBy: actor.id,
                    changes: pick(
                      describeDraftChanges(live, {
                        website,
                        pages: publishable,
                        maps: savedMaps,
                      }),
                      ['pageChanges', 'mapChanges', 'websiteChanged', 'themeChanged'],
                    ),
                    publishedAt: clock.now(),
                  }),
                ),
              ),
          )
          .map((release) => {
            audit.record({
              type: 'release.published',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: website.id,
              releaseId: release.id,
              releaseNumber: release.releaseNumber,
            });
            return toReleaseSummaryView(release, release.id);
          })
          .mapErr((error) => this.reportBlocked(actor, website, error)),
      );
  }

  /** A blocked publish is a recoverable anomaly worth alerting on; the error itself is unchanged. */
  private reportBlocked(
    actor: Actor,
    website: PublishableWebsite,
    error: PublishFailure,
  ): PublishFailure {
    if (error.kind === 'validation') {
      this.deps.audit.record({
        type: 'release.publish_blocked',
        actorId: actor.id,
        tenantId: actor.tenantId,
        websiteId: website.id,
        fields: Object.keys(error.fieldErrors),
      });
    }
    return error;
  }
}
