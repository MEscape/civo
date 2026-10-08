import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { assembleReleaseSnapshot } from '../../domain/models/release-assembly';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toReleaseSummaryView } from '../release-view-mappers';

import type { PublishableWebsite } from '../../domain/models/publishable';
import type { PublishReleaseInput, ReleaseSummaryView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { PublishReleaseDependencies } from '../release-dependencies';

type PublishFailure = ValidationAppError | ConflictAppError | InfrastructureAppError;

export type PublishReleaseError = LoadReleaseWebsiteError | ConflictAppError;

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
    const { pages, components, releases, audit, clock } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, input.websiteId, 'release.publish').andThen(
      ({ actor, website }) =>
        pages
          .listForRelease(website.id)
          .andThen((publishable) =>
            assembleReleaseSnapshot({
              website,
              pages: publishable,
              resolveComponent: (type) => components.resolve(type),
            }).asyncAndThen((snapshot) =>
              releases.publish({
                websiteId: website.id,
                snapshot,
                publishedAt: clock.now(),
              }),
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
