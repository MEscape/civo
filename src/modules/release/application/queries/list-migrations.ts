import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { MIGRATION_HISTORY_PAGE_LIMITS } from '../list-limits';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toMigrationSummaryView } from '../release-view-mappers';

import type { MigrationSummaryView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { MigrationDependencies } from '../release-dependencies';

/** The page asked for, as the address carries it: untrusted text, resolved here. */
export interface ListMigrationsOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}

/**
 * One page of a website's migration history, newest first; never loads a
 * plan. A page past the end answers the last one.
 */
export class ListMigrations {
  constructor(private readonly deps: MigrationDependencies) {}

  execute(
    rawWebsiteId: string,
    options: ListMigrationsOptions = {},
  ): AppResultAsync<Page<MigrationSummaryView>, LoadReleaseWebsiteError> {
    const requested = resolvePageRequest(options, MIGRATION_HISTORY_PAGE_LIMITS);

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read')
      .andThen(({ website }) =>
        loadClampedPage(requested, (request) =>
          this.deps.migrations.listByWebsite(website.id, request),
        ),
      )
      .map((found) => ({ ...found, items: found.items.map(toMigrationSummaryView) }));
  }
}
