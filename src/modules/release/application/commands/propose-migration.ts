import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, UnexpectedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseNotPublished } from '../../domain/errors/release-errors';
import { isUpToDate } from '../../domain/models/migration-plan';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { RELEASE_RATE_LIMITS } from '../rate-limits';
import { toMigrationProposalView } from '../release-view-mappers';
import { planLiveRelease } from '../services/live-release-plan';
import { withinActorLimit } from '../services/within-actor-limit';

import type { WebsiteId } from '../../domain/models/ids';
import type { Release } from '../../domain/models/release';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { MigrationProposalView, ProposeMigrationInput } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ProposeMigrationDependencies } from '../release-dependencies';
import type { LiveReleasePlan } from '../services/live-release-plan';
import type { ActorLimitError } from '../services/within-actor-limit';

export type ProposeMigrationError =
  LoadReleaseWebsiteError | ReleaseReadError | UnexpectedAppError | ActorLimitError;

function requirePublished(release: Release | null): AppResultAsync<Release, NotFoundAppError> {
  return release === null ? errAsync(releaseNotPublished()) : okAsync(release);
}

/**
 * Plans what upgrading the live release to today's component versions
 * would change, and records the proposal so it can be reviewed and applied
 * later. Read-only with respect to pages: nothing an editor is looking at
 * changes.
 *
 * A website that is already up to date has nothing to review, so nothing is
 * recorded: otherwise every check would add a pointless row to the history.
 */
export class ProposeMigration {
  constructor(private readonly deps: ProposeMigrationDependencies) {}

  execute(
    input: ProposeMigrationInput,
  ): AppResultAsync<MigrationProposalView, ProposeMigrationError> {
    const { releases } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, input.websiteId, 'release.publish')
      .andThen(withinActorLimit(this.deps, RELEASE_RATE_LIMITS.proposeMigration))
      .andThen(({ actor, website }) =>
        releases
          .findPublished(website.id)
          .andThen(requirePublished)
          .andThen((release) =>
            planLiveRelease(this.deps, release).asyncAndThen((planned) => okAsync(planned)),
          )
          .andThen(({ source, plan }) =>
            this.record({ actor, websiteId: website.id, source, plan }),
          ),
      );
  }

  private record({
    actor,
    websiteId,
    source,
    plan,
  }: {
    readonly actor: Actor;
    readonly websiteId: WebsiteId;
    readonly source: LiveReleasePlan['source'];
    readonly plan: LiveReleasePlan['plan'];
  }): AppResultAsync<MigrationProposalView, InfrastructureAppError> {
    const { migrations, audit } = this.deps;
    const sourceReleaseId = source.releaseId;

    if (isUpToDate(plan)) {
      return okAsync(toMigrationProposalView({ migrationId: null, sourceReleaseId, plan }));
    }

    return migrations
      .create({ websiteId, sourceReleaseId, proposedBy: actor.id, plan })
      .map((migration) => {
        const view = toMigrationProposalView({
          migrationId: migration.id,
          sourceReleaseId,
          plan,
        });
        audit.record({
          type: 'release.migration_proposed',
          actorId: actor.id,
          tenantId: actor.tenantId,
          websiteId,
          migrationId: migration.id,
          sourceReleaseId,
          needsReviewCount: view.plan.counts.needs_review,
          unresolvableCount: view.plan.counts.unresolvable,
        });
        return view;
      });
  }
}
