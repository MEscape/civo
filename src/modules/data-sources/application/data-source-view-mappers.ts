import { describeRestEndpoint } from '../domain/config/rest-connection-config';

import type {
  DataSourceView,
  DataSourceWithDatasetsView,
  DatasetView,
} from './contracts/data-source-views';
import type { DataSource } from '../domain/models/data-source';
import type { Dataset } from '../domain/models/dataset';
import type { DataSourceWithDatasets } from '../domain/ports/data-source.repository';

export function toDataSourceView(source: DataSource): DataSourceView {
  return {
    id: source.id,
    websiteId: source.websiteId,
    name: source.name,
    kind: source.kind,
    status: source.status,
    // Only REST sources have an endpoint to show.
    endpoint: source.kind === 'REST' ? describeRestEndpoint(source.config) : null,
    lastCheckedAt: source.lastCheckedAt,
    lastErrorCode: source.lastErrorCode,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function toDatasetView(dataset: Dataset): DatasetView {
  return {
    id: dataset.id,
    websiteId: dataset.websiteId,
    source: {
      id: dataset.source.id,
      name: dataset.source.name,
      kind: dataset.source.kind,
      status: dataset.source.status,
    },
    name: dataset.name,
    slug: dataset.slug,
    canonicalKind: dataset.canonicalKind,
    mapping: dataset.mapping,
    status: dataset.status,
    lastFetchedAt: dataset.lastFetchedAt,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
  };
}

export function toDataSourceWithDatasetsView(
  row: DataSourceWithDatasets,
): DataSourceWithDatasetsView {
  return {
    ...toDataSourceView(row.source),
    datasets: row.datasets.map(toDatasetView),
  };
}
