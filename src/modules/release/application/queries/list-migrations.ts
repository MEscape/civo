import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { MIGRATION_HISTORY_PAGE_LIMITS } from '../release-limits';
import { toMigrationSummaryView } from '../release-view-mappers';

import type { MigrationSummaryView } from '../contracts/migration-views';
import type { HistoryPageOptions } from '../contracts/release-inputs';
import type { ReleaseOperationError, MigrationDependencies } from '../release-dependencies';

/**
 * One page of a website's migration history, newest first; never loads a
 * plan. A page past the end answers the last one.
 */
export class ListMigrations {
  constructor(private readonly deps: MigrationDependencies) {}

  execute(
    rawWebsiteId: string,
    options: HistoryPageOptions = {},
  ): AppResultAsync<Page<MigrationSummaryView>, ReleaseOperationError> {
    const requested = resolvePageRequest(options, MIGRATION_HISTORY_PAGE_LIMITS);

    return this.deps.access
      .authorizeWebsite('release.read', rawWebsiteId)
      .andThen(({ websiteId }) =>
        loadClampedPage(requested, (request) =>
          this.deps.migrations.listByWebsite(websiteId, request),
        ),
      )
      .map((found) => ({ ...found, items: found.items.map(toMigrationSummaryView) }));
  }
}
