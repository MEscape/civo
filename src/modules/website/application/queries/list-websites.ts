import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import {
  DEFAULT_WEBSITE_LIST_LIMIT,
  MAX_WEBSITE_LIST_LIMIT,
  MIN_WEBSITE_LIST_LIMIT,
} from '../list-limits';
import { toWebsiteSummaryView } from '../website-view-mappers';

import type { WebsiteSummaryView } from '../contracts/website-views';
import type { WebsiteDependencies } from '../website-dependencies';

export interface ListWebsitesOptions {
  readonly limit?: number;
}

/** Lists the actor's own tenant, newest activity first. Always bounded. */
export class ListWebsites {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(
    options: ListWebsitesOptions = {},
  ): AppResultAsync<readonly WebsiteSummaryView[], AuthorizationError | InfrastructureAppError> {
    const requested =
      isDefined(options.limit) && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_WEBSITE_LIST_LIMIT;
    const limit = clamp(requested, MIN_WEBSITE_LIST_LIMIT, MAX_WEBSITE_LIST_LIMIT);

    return this.deps.authorization
      .requireInTenant('website.read')
      .andThen((actor) => this.deps.websites.listByTenant(actor.tenantId, limit))
      .map((summaries) => summaries.map(toWebsiteSummaryView));
  }
}
