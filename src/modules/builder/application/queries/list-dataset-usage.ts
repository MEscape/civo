import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { componentsAwaitingDataOf, datasetUsesOf } from '../../domain/models/page-dataset-usage';
import { readWebsitePages } from '../services/read-website-pages';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { ListPagesDependencies } from '../builder-dependencies';
import type {
  ComponentAwaitingDataView,
  DatasetPageUseView,
  DatasetUsageView,
} from '../contracts/dataset-usage-views';

/**
 * Which pages use which dataset, and which components still wait for one,
 * for the data sources screen: it tells a dataset that is ready from one that
 * is also on a page, and where a new one could go. Reads the website's
 * pages in the tenant-scoped slices the page list uses, up to the release
 * bound; a website past it is answered from its first pages and says so
 * (`isTruncated`), so the screen can warn instead of presenting it as complete.
 */
export class ListDatasetUsage {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<DatasetUsageView, BuilderAccessError | InfrastructureAppError> {
    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          readWebsitePages(this.deps.pages, { websiteId: id, tenantId: scope.tenantId }),
        ),
      )
      .map(({ pages, isTruncated }) => {
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
        return { byDataset: usage, awaiting, isTruncated };
      });
  }
}
