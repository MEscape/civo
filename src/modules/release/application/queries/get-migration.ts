import type { NotFoundAppError, UnexpectedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseMigrationNotFound } from '../../domain/errors/release-errors';
import { parseMigrationId } from '../../domain/models/ids';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toMigrationDetailView } from '../release-view-mappers';

import type { Migration } from '../../domain/models/migration';
import type { MigrationDetailView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { MigrationDependencies } from '../release-dependencies';

export type GetMigrationError = LoadReleaseWebsiteError | UnexpectedAppError;

/**
 * One migration with its stored plan, so a proposal can be reopened for
 * review after the page was left. Reading the plan validates it: a
 * corrupted plan is refused rather than shown.
 */
export class GetMigration {
  constructor(private readonly deps: MigrationDependencies) {}

  execute(
    rawWebsiteId: string,
    rawMigrationId: string,
  ): AppResultAsync<MigrationDetailView, GetMigrationError> {
    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read')
      .andThen(({ website }) =>
        parseMigrationId(rawMigrationId).asyncAndThen((id) =>
          this.deps.migrations.findById(website.id, id),
        ),
      )
      .andThen((migration): AppResultAsync<Migration, NotFoundAppError> =>
        migration === null ? errAsync(releaseMigrationNotFound()) : okAsync(migration),
      )
      .map(toMigrationDetailView);
  }
}
