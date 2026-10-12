import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import { clampToLastPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { okAsync } from '@lib/result';
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
 * One page of the actor's own tenant's websites, newest activity first. A
 * page past the end (websites were deleted meanwhile) answers the last one.
 */
export class ListWebsites {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(
    options: ListWebsitesOptions = {},
  ): AppResultAsync<Page<WebsiteSummaryView>, AuthorizationError | InfrastructureAppError> {
    const requested = resolvePageRequest(options, WEBSITE_PAGE_LIMITS);
    const { websites } = this.deps;

    return this.deps.authorization
      .requireInTenant('website.read')
      .andThen((actor) =>
        websites.listByTenant(actor.tenantId, requested).andThen((first) => {
          const request = clampToLastPage(requested, first.total);
          return request.page === first.page
            ? okAsync(first)
            : websites.listByTenant(actor.tenantId, request);
        }),
      )
      .map((found) => ({ ...found, items: found.items.map(toWebsiteSummaryView) }));
  }
}
