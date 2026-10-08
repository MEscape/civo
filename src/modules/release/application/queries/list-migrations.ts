import type { AppResultAsync } from '@lib/result';
import { clamp } from '@lib/utils';

import {
  DEFAULT_MIGRATION_LIST_LIMIT,
  MAX_MIGRATION_LIST_LIMIT,
  MIN_MIGRATION_LIST_LIMIT,
} from '../list-limits';
import { loadAuthorizedReleaseWebsite } from '../load-authorized-release-website';
import { toMigrationSummaryView } from '../release-view-mappers';

import type { MigrationSummaryView } from '../contracts/release-views';
import type { LoadReleaseWebsiteError } from '../load-authorized-release-website';
import type { MigrationDependencies } from '../release-dependencies';

export interface ListMigrationsOptions {
  readonly limit?: number;
}

/** A website's migration history, newest first. Always bounded, and never loads a plan. */
export class ListMigrations {
  constructor(private readonly deps: MigrationDependencies) {}

  execute(
    rawWebsiteId: string,
    options: ListMigrationsOptions = {},
  ): AppResultAsync<readonly MigrationSummaryView[], LoadReleaseWebsiteError> {
    const requested =
      options.limit !== undefined && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_MIGRATION_LIST_LIMIT;
    const limit = clamp(requested, MIN_MIGRATION_LIST_LIMIT, MAX_MIGRATION_LIST_LIMIT);

    return loadAuthorizedReleaseWebsite(this.deps, rawWebsiteId, 'release.read')
      .andThen(({ website }) => this.deps.migrations.listByWebsite(website.id, limit))
      .map((summaries) => summaries.map(toMigrationSummaryView));
  }
}
