import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { applyMigrationPlan } from '../../domain/migration/apply-migration';
import { RELEASE_RATE_LIMITS } from '../rate-limits';
import { judgeMigrationOutcome } from '../services/migration-outcome';
import { loadMigrationReview } from '../services/migration-review';
import { withinActorLimit } from '../services/within-actor-limit';
import { writeMigratedPages } from '../services/write-migrated-pages';

import type { ApplyMigrationInput } from '../contracts/migration-inputs';
import type { ApplyMigrationResultView } from '../contracts/migration-views';
import type { ReleaseOperationError, ApplyMigrationDependencies } from '../release-dependencies';
import type { MigrationReview, MigrationReviewError } from '../services/migration-review';
import type { ActorLimitError } from '../services/within-actor-limit';
import type { PageResult, StopError } from '../services/write-migrated-pages';

export type ApplyMigrationError = ReleaseOperationError | MigrationReviewError | ActorLimitError;

/**
 * Applies a reviewed migration: writes the migrated trees as new draft
 * revisions. It never touches the live release.
 *
 * What is applied is decided on the SERVER from the stored plan. The
 * client sends only its resolutions, and those are checked against that
 * plan, so a request can never introduce props the reviewer did not see.
 *
 * Pages live in another module and cannot share a transaction, so the
 * result reports each page's outcome and the migration is only marked
 * applied once every changed page holds the migrated tree. A draft that
 * was edited since publishing is left alone, never overwritten.
 */
export class ApplyMigration {
  constructor(private readonly deps: ApplyMigrationDependencies) {}

  execute(
    input: ApplyMigrationInput,
  ): AppResultAsync<ApplyMigrationResultView, ApplyMigrationError | StopError> {
    return this.deps.access
      .authorizeWebsite('release.publish', input.websiteId)
      .andThen(withinActorLimit(this.deps, RELEASE_RATE_LIMITS.applyMigration))
      .andThen(({ actor, websiteId }) =>
        loadMigrationReview(this.deps, { actor, websiteId, input }).andThen((review) =>
          this.applyPages(review),
        ),
      );
  }

  private applyPages(
    review: MigrationReview,
  ): AppResultAsync<ApplyMigrationResultView, ApplyMigrationError | StopError> {
    const { migration, pages, resolutions } = review;
    const { changedPages, skippedNodeCount } = applyMigrationPlan(
      migration.plan,
      pages,
      resolutions,
    );

    return writeMigratedPages(this.deps, review, changedPages).andThen((results) =>
      this.finish(review, results, skippedNodeCount),
    );
  }

  private finish(
    review: MigrationReview,
    results: readonly PageResult[],
    skippedNodeCount: number,
  ): AppResultAsync<ApplyMigrationResultView, ApplyMigrationError> {
    const { migrations, audit, clock } = this.deps;
    const { actor, websiteId, migration, resolutions } = review;
    const outcome = judgeMigrationOutcome({ review, results, skippedNodeCount });

    if (!outcome.isFinished) {
      if (!outcome.isComplete) {
        audit.record({
          type: 'release.migration_apply_incomplete',
          actorId: actor.id,
          tenantId: actor.tenantId,
          websiteId,
          migrationId: migration.id,
          failedPageCount: outcome.failedPageCount,
          divergedPageCount: outcome.divergedPageCount,
        });
      }
      return okAsync(outcome.view);
    }

    return migrations
      .markApplied({
        id: migration.id,
        websiteId,
        appliedBy: actor.id,
        appliedAt: clock.now(),
        resolutions,
      })
      .map(() => {
        audit.record({
          type: 'release.migration_applied',
          actorId: actor.id,
          tenantId: actor.tenantId,
          websiteId,
          migrationId: migration.id,
          writtenPageCount: outcome.writtenPageCount,
          skippedNodeCount,
        });
        return { ...outcome.view, status: 'applied' as const };
      });
  }
}
