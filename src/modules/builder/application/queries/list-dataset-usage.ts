import type { AuthorizationError, TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { PageRequest } from '@lib/pagination';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { componentsAwaitingDataOf, datasetUsesOf } from '../../domain/models/page-dataset-usage';
import { MAX_RELEASE_PAGES, PAGE_LIST_LIMITS } from '../list-limits';

import type { WebsiteId } from '../../domain/models/ids';
import type { PageListItem } from '../../domain/models/page';
import type {
  ComponentAwaitingDataView,
  DatasetPageUseView,
  DatasetUsageView,
} from '../contracts/page-views';
import type { ListPagesDependencies } from '../page-dependencies';

/**
 * Which pages use which dataset, and which components still wait for one,
 * for the data sources screen: it tells a dataset that is ready from one that
 * is also on a page, and where a new one could go. Reads the website's
 * pages in the tenant-scoped slices the page list uses, up to the release
 * bound; a website past it is answered from its first pages.
 */
export class ListDatasetUsage {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<
    DatasetUsageView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    return this.deps.authorization
      .requireInTenant('page.read')
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          this.readFrom({ websiteId: id, tenantId: actor.tenantId }),
        ),
      )
      .map((pages) => {
        const usage: Record<string, DatasetPageUseView[]> = {};
        const awaiting: ComponentAwaitingDataView[] = [];
        for (const page of pages) {
          for (const component of page.config === null
            ? []
            : componentsAwaitingDataOf(page.config, this.deps.components)) {
            awaiting.push({ pageId: page.id, title: page.title, ...component });
          }
          const byDataset = new Map<string, Array<{ nodeId: string; type: string }>>();
          for (const use of page.config === null
            ? []
            : datasetUsesOf(page.config, this.deps.components)) {
            const components = byDataset.get(use.datasetId) ?? [];
            components.push({ nodeId: use.nodeId, type: use.type });
            byDataset.set(use.datasetId, components);
          }
          for (const [datasetId, components] of byDataset) {
            (usage[datasetId] ??= []).push({ pageId: page.id, title: page.title, components });
          }
        }
        return { byDataset: usage, awaiting };
      });
  }

  /** Every page, one slice after the other, never more than the release bound. */
  private readFrom(
    scope: { readonly websiteId: WebsiteId; readonly tenantId: TenantId },
    request: PageRequest = { page: 1, pageSize: PAGE_LIST_LIMITS.maxPageSize },
    read: readonly PageListItem[] = [],
  ): AppResultAsync<readonly PageListItem[], InfrastructureAppError> {
    return this.deps.pages
      .listByWebsite(scope.websiteId, scope.tenantId, request)
      .andThen((slice) => {
        const all = [...read, ...slice.items];
        const isLast = slice.page >= slice.pageCount || all.length >= MAX_RELEASE_PAGES;
        return isLast
          ? okAsync(all)
          : this.readFrom(scope, { ...request, page: request.page + 1 }, all);
      });
  }
}
