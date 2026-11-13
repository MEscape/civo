import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { WEBSITE_PAGE_LIMITS } from '../website-limits';
import { toWebsiteSummaryView } from '../website-view-mappers';

import type { WebsiteAccessError } from '../../domain/ports/website-access.port';
import type { ListWebsitesOptions, WebsiteListView } from '../contracts/website-views';
import type { ExistingWebsiteDependencies } from '../website-dependencies';

/**
 * One page of the websites the actor may read, regardless of the current tenant.
 * Auth supplies the scope before counts and pagination. Platform authority reads all;
 * membership authority reads an explicit allowlist, with any truncation reported.
 * A page past the end answers the last one.
 *
 * @authorization system Auth resolves readable websites through WebsiteAccess before persistence reads.
 */
export class ListWebsites {
  constructor(private readonly deps: ExistingWebsiteDependencies) {}

  execute(
    options: ListWebsitesOptions = {},
  ): AppResultAsync<WebsiteListView, WebsiteAccessError | InfrastructureAppError> {
    const requested = resolvePageRequest(options, WEBSITE_PAGE_LIMITS);
    const { websites } = this.deps;

    return this.deps.access.listReadableWebsites().andThen((readable) =>
      loadClampedPage(requested, (request) => websites.list(request, readable.websiteIds)).map(
        (found) => ({
          ...found,
          items: found.items.map(toWebsiteSummaryView),
          isWebsitesTruncated: readable.isTruncated,
        }),
      ),
    );
  }
}
