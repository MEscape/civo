import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { PageRequest } from '@lib/pagination';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_RELEASE_PAGES, PAGE_LIST_LIMITS } from '../builder-limits';

import type { WebsiteId } from '../../domain/models/ids';
import type { PageListItem } from '../../domain/models/page';
import type { PageRepository } from '../../domain/ports/page.repository';

/** The pages read for an answer, and whether the website holds more than were read. */
export interface PagesRead {
  readonly pages: readonly PageListItem[];
  readonly isTruncated: boolean;
}

/**
 * Every page of a website, in the tenant-scoped slices the page list uses, never more than the
 * release bound: a website past it is answered from its first pages and says so (`isTruncated`).
 */
export function readWebsitePages(
  pages: PageRepository,
  scope: { readonly websiteId: WebsiteId; readonly tenantId: TenantId },
): AppResultAsync<PagesRead, InfrastructureAppError> {
  const readFrom = (
    request: PageRequest,
    read: readonly PageListItem[],
  ): AppResultAsync<PagesRead, InfrastructureAppError> =>
    pages.listByWebsite(scope.websiteId, scope.tenantId, request).andThen((slice) => {
      const all = [...read, ...slice.items];
      if (slice.page >= slice.pageCount) {
        return okAsync({ pages: all, isTruncated: false });
      }
      return all.length >= MAX_RELEASE_PAGES
        ? okAsync({ pages: all, isTruncated: true })
        : readFrom({ ...request, page: request.page + 1 }, all);
    });
  return readFrom({ page: 1, pageSize: PAGE_LIST_LIMITS.maxPageSize }, []);
}
