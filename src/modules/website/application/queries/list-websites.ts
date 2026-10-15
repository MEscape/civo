import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { WEBSITE_PAGE_LIMITS } from '../list-limits';
import { toWebsiteSummaryView } from '../website-view-mappers';

import type { WebsiteSummaryView } from '../contracts/website-views';
import type { WebsiteDependencies } from '../website-dependencies';

/** The page asked for, as the address carries it: untrusted text, resolved here. */
export interface ListWebsitesOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}

/**
 * One page of every website of the platform, newest activity first. Only the
 * platform administrator may list them; a tenant's members know their own
 * website and nothing else. A page past the end (websites were deleted
 * meanwhile) answers the last one.
 */
export class ListWebsites {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(
    options: ListWebsitesOptions = {},
  ): AppResultAsync<Page<WebsiteSummaryView>, AuthorizationError | InfrastructureAppError> {
    const requested = resolvePageRequest(options, WEBSITE_PAGE_LIMITS);
    const { websites } = this.deps;

    return this.deps.authorization
      .requireInTenant('website.list.all')
      .andThen(() => loadClampedPage(requested, (request) => websites.list(request)))
      .map((found) => ({ ...found, items: found.items.map(toWebsiteSummaryView) }));
  }
}
