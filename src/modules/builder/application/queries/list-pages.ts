import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import { parseWebsiteId } from '../../domain/models/ids';
import { DEFAULT_PAGE_LIST_LIMIT, MAX_PAGE_LIST_LIMIT, MIN_PAGE_LIST_LIMIT } from '../list-limits';
import { toPageSummaryView } from '../page-view-mappers';

import type { ListPagesInput, PageSummaryView } from '../contracts/page-views';
import type { PageAccessDependencies } from '../page-dependencies';

/**
 * Lists a website's pages within the actor's own tenant. Always bounded.
 * A website of another tenant yields an empty list, the same as a website
 * without pages, so the result discloses nothing about foreign ids.
 */
export class ListPages {
  constructor(private readonly deps: PageAccessDependencies) {}

  execute(
    input: ListPagesInput,
  ): AppResultAsync<
    readonly PageSummaryView[],
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const requested =
      isDefined(input.limit) && Number.isInteger(input.limit)
        ? input.limit
        : DEFAULT_PAGE_LIST_LIMIT;
    const limit = clamp(requested, MIN_PAGE_LIST_LIMIT, MAX_PAGE_LIST_LIMIT);

    return this.deps.authorization
      .requireInTenant('page.read')
      .andThen((actor) =>
        parseWebsiteId(input.websiteId).asyncAndThen((websiteId) =>
          this.deps.pages.listByWebsite(websiteId, actor.tenantId, limit),
        ),
      )
      .map((summaries) => summaries.map(toPageSummaryView));
  }
}
