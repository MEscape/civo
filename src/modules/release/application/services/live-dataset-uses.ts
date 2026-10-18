import type { DatasetId } from '../../domain/models/ids';
import type { Release } from '../../domain/models/release';
import type { DataSourcePort } from '../../domain/ports/data-source.port';
import type { LiveDatasetUsageView } from '../contracts/release-views';

/** The pages of the live release that show each dataset, by dataset id. */
export function liveDatasetUsageOf(
  live: Release | null,
  data: Pick<DataSourcePort, 'datasetsInStoredPage'>,
): LiveDatasetUsageView {
  const usage: Record<string, Array<{ path: string; title: string }>> = {};
  for (const page of live?.snapshot.pages ?? []) {
    data.datasetsInStoredPage(page.config).forEach((datasetId) => {
      (usage[datasetId] ??= []).push({ path: page.path, title: page.title });
    });
  }
  return usage;
}

/** The datasets the live release shows. */
export function liveDatasetsOf(
  live: Release | null,
  data: Pick<DataSourcePort, 'datasetsInStoredPage'>,
): ReadonlySet<DatasetId> {
  return new Set(
    (live?.snapshot.pages ?? []).flatMap((page) => [...data.datasetsInStoredPage(page.config)]),
  );
}
