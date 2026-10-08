import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  ForbiddenAppError,
  NotFoundAppError,
  UnauthorizedAppError,
  UnexpectedAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseMigrationNotFound, releaseNotPublished } from '../../domain/errors/release-errors';
import { applyMigrationPlan } from '../../domain/models/apply-migration';
import { parseConflictResolutions } from '../../domain/models/conflict-resolution';
import { parseMigrationId } from '../../domain/models/ids';
import { ensureApplicable, ensureSourceIsLive } from '../../domain/models/migration';
import { isSuccessfulOutcome, judgeDraft } from '../../domain/models/page-draft';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';

import type { AppliedPage } from '../../domain/models/apply-migration';
import type { ConflictResolutions } from '../../domain/models/conflict-resolution';
import type { WebsiteId } from '../../domain/models/ids';
import type { Migration } from '../../domain/models/migration';
import type { PageDraft, PageOutcome } from '../../domain/models/page-draft';
import type { PageTree } from '../../domain/models/page-tree';
import type { Release } from '../../domain/models/release';
import type { MigrationReadError } from '../../domain/ports/migration.repository';
import type { PageDraftError } from '../../domain/ports/page-source.port';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { ApplyMigrationInput, ApplyMigrationResultView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { ApplyMigrationDependencies } from '../release-dependencies';

export type ApplyMigrationError =
  | LoadReleaseWebsiteError
  | MigrationReadError
  | ReleaseReadError
  | PageDraftError
  | ConflictAppError
  | UnexpectedAppError;

/** Failures that must stop the whole operation instead of being reported per page. */
type StopError = UnauthorizedAppError | ForbiddenAppError;

interface PageResult {
  readonly path: string;
  readonly outcome: PageOutcome;
  readonly updatedNodeCount: number;
}

interface Review {
  readonly actor: Actor;
  readonly websiteId: WebsiteId;
  readonly migration: Migration;
  /** The live release's trees: what the plan was computed from. */
  readonly published: ReadonlyMap<string, PageTree>;
  /** Every page's current draft, read once for the whole website. */
  readonly drafts: ReadonlyMap<string, PageDraft>;
  readonly pages: readonly PageTree[];
  readonly resolutions: ConflictResolutions;
}

function requireMigration(
  migration: Migration | null,
): AppResultAsync<Migration, NotFoundAppError> {
  return migration === null ? errAsync(releaseMigrationNotFound()) : okAsync(migration);
}

function requirePublished(release: Release | null): AppResultAsync<Release, NotFoundAppError> {
  return release === null ? errAsync(releaseNotPublished()) : okAsync(release);
}

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
    return loadAuthorizedReleaseWebsite(this.deps, input.websiteId, 'release.publish').andThen(
      ({ actor, website }) =>
        this.loadReview(actor, website.id, input).andThen((review) => this.applyPages(review)),
    );
  }

  /**
   * Everything that must hold before a single page is written: the
   * migration exists, is still proposed, was computed from the release that
   * is live now, and the resolutions only name what the plan flagged.
   */
  private loadReview(
    actor: Actor,
    websiteId: WebsiteId,
    input: ApplyMigrationInput,
  ): AppResultAsync<Review, ApplyMigrationError> {
    const { migrations, releases, pages } = this.deps;

    return parseMigrationId(input.migrationId)
      .asyncAndThen((id) => migrations.findById(websiteId, id))
      .andThen(requireMigration)
      .andThen((migration) =>
        ensureApplicable(migration).asyncAndThen((applicable) => okAsync(applicable)),
      )
      .andThen((migration) =>
        releases
          .findPublished(websiteId)
          .andThen(requirePublished)
          .andThen((release) =>
            ensureSourceIsLive(migration, release.id)
              .andThen(() => parseConflictResolutions(input.resolutions, migration.plan))
              .andThen((resolutions) =>
                pages.readTrees(release.snapshot.pages).map((trees) => ({ resolutions, trees })),
              )
              .asyncAndThen(({ resolutions, trees }) =>
                pages.listDrafts(websiteId).map((drafts): Review => ({
                  actor,
                  websiteId,
                  migration,
                  pages: trees,
                  published: new Map(trees.map((tree) => [tree.path, tree])),
                  drafts: new Map(drafts.map((draft) => [draft.path, draft])),
                  resolutions,
                })),
              ),
          ),
      );
  }

  private applyPages(
    review: Review,
  ): AppResultAsync<ApplyMigrationResultView, ApplyMigrationError | StopError> {
    const { migration, pages, resolutions } = review;
    const { changedPages, skippedNodeCount } = applyMigrationPlan(
      migration.plan,
      pages,
      resolutions,
    );

    return this.writePages(review, changedPages).andThen((results) =>
      this.finish(review, results, skippedNodeCount),
    );
  }

  /** One page after another: the builder revises pages independently, and the order is stable. */
  private writePages(
    review: Review,
    pages: readonly AppliedPage[],
  ): AppResultAsync<readonly PageResult[], StopError> {
    return pages.reduce<AppResultAsync<readonly PageResult[], StopError>>(
      (done, page) =>
        done.andThen((results) =>
          this.writePage(review, page).map((result) => [...results, result]),
        ),
      okAsync([]),
    );
  }

  private writePage(review: Review, page: AppliedPage): AppResultAsync<PageResult, StopError> {
    const toResult = (outcome: PageOutcome): PageResult => ({
      path: page.path,
      outcome,
      updatedNodeCount: isSuccessfulOutcome(outcome) ? page.updatedNodeIds.length : 0,
    });

    const published = review.published.get(page.path);
    const draft = review.drafts.get(page.path);
    if (published === undefined || draft === undefined) {
      return okAsync(toResult('page_missing'));
    }

    switch (judgeDraft(draft, published, page.children)) {
      case 'already_applied':
        return okAsync(toResult('already_applied'));
      case 'diverged':
        return okAsync(toResult('draft_diverged'));
      case 'writable':
        return this.deps.pages
          .replaceChildren({
            pageId: draft.pageId,
            expectedVersion: draft.version,
            children: page.children,
          })
          .map(() => toResult('written'))
          .orElse((error) => this.settle(error, toResult));
    }
  }

  /**
   * An unauthenticated or forbidden builder call stops the operation. Someone
   * saving between our read and our write is the same as a diverged draft.
   * Any other failure is reported against its page, so the caller sees what
   * was written before it and can retry the rest.
   */
  private settle(
    error: ConflictAppError | PageDraftError,
    toResult: (outcome: PageOutcome) => PageResult,
  ): AppResultAsync<PageResult, StopError> {
    if (error.kind === 'unauthorized' || error.kind === 'forbidden') {
      return errAsync(error);
    }
    return okAsync(toResult(error.kind === 'conflict' ? 'draft_diverged' : 'failed'));
  }

  private finish(
    review: Review,
    results: readonly PageResult[],
    skippedNodeCount: number,
  ): AppResultAsync<ApplyMigrationResultView, ApplyMigrationError> {
    const { migrations, audit, clock } = this.deps;
    const { actor, websiteId, migration, resolutions } = review;

    const isComplete = results.every((result) => isSuccessfulOutcome(result.outcome));
    // Nothing written and something left unresolved: keep it open so it can be resolved and retried.
    const isFinished = isComplete && (results.length > 0 || skippedNodeCount === 0);

    const toView = (status: 'proposed' | 'applied'): ApplyMigrationResultView => ({
      migrationId: migration.id,
      websiteId,
      status,
      pages: results.map(({ path, outcome }) => ({ path, outcome })),
      updatedNodeCount: results.reduce((total, result) => total + result.updatedNodeCount, 0),
      skippedNodeCount,
    });

    if (!isFinished) {
      if (!isComplete) {
        audit.record({
          type: 'release.migration_apply_incomplete',
          actorId: actor.id,
          tenantId: actor.tenantId,
          websiteId,
          migrationId: migration.id,
          failedPageCount: results.filter((r) => r.outcome === 'failed').length,
          divergedPageCount: results.filter((r) => r.outcome === 'draft_diverged').length,
        });
      }
      return okAsync(toView('proposed'));
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
          writtenPageCount: results.filter((r) => r.outcome === 'written').length,
          skippedNodeCount,
        });
        return toView('applied');
      });
  }
}
