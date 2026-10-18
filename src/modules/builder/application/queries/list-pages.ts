import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page as Slice } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { outlineOf } from '../../domain/models/page-outline';
import { PAGE_LIST_LIMITS } from '../list-limits';
import { toPageSummaryView } from '../page-view-mappers';

import type { ListPagesInput, PageListItemView } from '../contracts/page-views';
import type { ListPagesDependencies } from '../page-dependencies';

/**
 * One page of a website's pages within the actor's own tenant. A website of
 * another tenant yields an empty list, the same as a website without pages,
 * so the result discloses nothing about foreign ids. A page past the end
 * answers the last one.
 */
export class ListPages {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    input: ListPagesInput,
  ): AppResultAsync<
    Slice<PageListItemView>,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const requested = resolvePageRequest(input, PAGE_LIST_LIMITS);

    return this.deps.authorization
      .requireInTenant('page.read')
      .andThen((actor) =>
        parseWebsiteId(input.websiteId).asyncAndThen((websiteId) =>
          loadClampedPage(requested, (request) =>
            this.deps.pages.listByWebsite(websiteId, actor.tenantId, request),
          ),
        ),
      )
      .map((found) => ({
        ...found,
        items: found.items.map((item) => ({
          ...toPageSummaryView(item),
          outline: item.config === null ? null : outlineOf(item.config, this.deps.components),
        })),
      }));
  }
}
