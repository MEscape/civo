import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page as Slice } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { outlineOf } from '../../domain/models/page-outline';
import { PAGE_LIST_LIMITS } from '../builder-limits';
import { toPageSummaryView } from '../builder-view-mappers';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { ListPagesDependencies } from '../builder-dependencies';
import type { ListPagesInput } from '../contracts/page-inputs';
import type { PageListItemView } from '../contracts/page-views';

/**
 * One page of the pages of the website the request names, which the actor must be
 * allowed to read: another website is refused, not listed as empty. A page past
 * the end answers the last one.
 */
export class ListPages {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    input: ListPagesInput,
  ): AppResultAsync<Slice<PageListItemView>, BuilderAccessError | InfrastructureAppError> {
    const requested = resolvePageRequest(input, PAGE_LIST_LIMITS);

    return this.deps.access
      .authorizeWebsite('page.read', input.websiteId)
      .andThen((scope) =>
        parseWebsiteId(input.websiteId).asyncAndThen((websiteId) =>
          loadClampedPage(requested, (request) =>
            this.deps.pages.listByWebsite(websiteId, scope.tenantId, request),
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
