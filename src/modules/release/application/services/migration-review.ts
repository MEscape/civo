import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseMigrationNotFound, releaseNotPublished } from '../../domain/errors/release-errors';
import { parseConflictResolutions } from '../../domain/migration/conflict-resolution';
import { ensureApplicable, ensureSourceIsLive } from '../../domain/migration/migration';
import { parseMigrationId } from '../../domain/models/ids';

import type { ConflictResolutions } from '../../domain/migration/conflict-resolution';
import type { Migration } from '../../domain/migration/migration';
import type { PageDraft } from '../../domain/migration/page-draft';
import type { PageTree } from '../../domain/migration/page-tree';
import type { WebsiteId } from '../../domain/models/ids';
import type { Release } from '../../domain/models/release';
import type { MigrationReadError } from '../../domain/ports/migration.repository';
import type { PageDraftError } from '../../domain/ports/page-source.port';
import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { ApplyMigrationInput } from '../contracts/migration-inputs';
import type { ApplyMigrationDependencies } from '../release-dependencies';

export type MigrationReviewError =
  | MigrationReadError
  | ReleaseReadError
  | PageDraftError
  | ConflictAppError
  | NotFoundAppError
  | ValidationAppError
  | UnexpectedAppError;

/** Who asks to apply which migration, on which website. */
export interface MigrationReviewRequest {
  readonly actor: Actor;
  readonly websiteId: WebsiteId;
  readonly input: ApplyMigrationInput;
}

export interface MigrationReview {
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
 * Everything that must hold before a single page is written: the
 * migration exists, is still proposed, was computed from the release that
 * is live now, and the resolutions only name what the plan flagged.
 */
export function loadMigrationReview(
  deps: Pick<ApplyMigrationDependencies, 'migrations' | 'releases' | 'pages'>,
  { actor, websiteId, input }: MigrationReviewRequest,
): AppResultAsync<MigrationReview, MigrationReviewError> {
  const { migrations, releases, pages } = deps;

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
              pages.listDrafts(websiteId).map((drafts): MigrationReview => ({
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
