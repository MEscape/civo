import { combineAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { categoriesOf, sampleCategoriesOf } from '../../domain/content/content-categories';
import { isContentKind } from '../../domain/content/content-definitions';
import { parseDatasetId, parseWebsiteId } from '../../domain/models/ids';

import type { ContentKind } from '../../domain/content/content-definitions';
import type { DatasetId, WebsiteId } from '../../domain/models/ids';
import type { ContentSource } from '../../domain/ports/content-source.port';
import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';
import type { ContentCategoriesRequest, ContentCategoriesView } from '../contracts/content-views';

type DatasetCategories = readonly [datasetId: string, categories: readonly string[]];

/** One dataset's categories; a dataset that cannot be read offers none instead of failing the editor. */
function readCategories(
  live: ContentSource,
  read: {
    readonly kind: ContentKind;
    readonly rawId: string;
    readonly datasetId: DatasetId;
    readonly websiteId: WebsiteId;
  },
): AppResultAsync<DatasetCategories, never> {
  const { kind, rawId, datasetId, websiteId } = read;
  return live
    .list({ kind, datasetId, websiteId })
    .map((batch): DatasetCategories => [rawId, categoriesOf(kind, batch.items)])
    .orElse(() => okAsync<DatasetCategories>([rawId, []]));
}

/**
 * The category values the editor offers for components that filter by one
 * (a district, a service category): the values each bound dataset really
 * contains, and those of the sample data a draft shows while nothing is bound.
 *
 * An unreadable dataset simply offers no values: the editor still works, the
 * dataset's own failure is reported where it is read for rendering.
 *
 * @authorization public Called only by the editor route after it authorized the page; datasets are read through data-sources within the given website and only distinct category labels leave.
 */
export class ListContentCategories {
  constructor(private readonly deps: PublicComponentPlatformDependencies) {}

  execute(request: ContentCategoriesRequest): AppResultAsync<ContentCategoriesView, never> {
    const { live } = this.deps;
    const sampleByKind = Object.fromEntries(
      request.kinds.filter(isContentKind).map((kind) => [kind, sampleCategoriesOf(kind)]),
    );
    const parsedWebsite = parseWebsiteId(request.websiteId);
    if (parsedWebsite.isErr()) {
      return okAsync({ byDataset: {}, sampleByKind });
    }

    const reads = request.datasets.flatMap((dataset) => {
      const parsedDataset = parseDatasetId(dataset.id);
      if (!isContentKind(dataset.kind) || parsedDataset.isErr()) {
        return [];
      }
      return [
        readCategories(live, {
          kind: dataset.kind,
          rawId: dataset.id,
          datasetId: parsedDataset.value,
          websiteId: parsedWebsite.value,
        }),
      ];
    });

    return combineAsync(reads).map((entries) => ({
      byDataset: Object.fromEntries(entries),
      sampleByKind,
    }));
  }
}
