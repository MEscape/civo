import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, UnexpectedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseNotPublished } from '../../domain/errors/release-errors';
import { isUpToDate, planMigration } from '../../domain/models/migration-plan';
import { toMigrationSource } from '../../domain/models/migration-source';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toMigrationProposalView } from '../release-view-mappers';

import type { WebsiteId } from '../../domain/models/ids';
import type { MigrationPlan } from '../../domain/models/migration-plan';
import type { MigrationSource } from '../../domain/models/migration-source';
import type { Release } from '../../domain/models/release';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { MigrationProposalView, ProposeMigrationInput } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ProposeMigrationDependencies } from '../release-dependencies';

export type ProposeMigrationError = LoadReleaseWebsiteError | ReleaseReadError | UnexpectedAppError;

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
    const { releases, pages, components } = this.deps;

    return loadAuthorizedReleaseWebsite(this.deps, input.websiteId, 'release.publish').andThen(
      ({ actor, website }) =>
        releases
          .findPublished(website.id)
          .andThen(requirePublished)
          .andThen((release) =>
            pages
              .readTrees(release.snapshot.pages)
              .asyncAndThen((trees) => okAsync(toMigrationSource(release, trees))),
          )
          .andThen((source) =>
            this.record({
              actor,
              websiteId: website.id,
              source,
              plan: planMigration(source, components),
            }),
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
    readonly source: MigrationSource;
    readonly plan: MigrationPlan;
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
