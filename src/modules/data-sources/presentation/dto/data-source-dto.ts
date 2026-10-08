import { toDatasetDto } from './dataset-dto';

import type { DatasetDto } from './dataset-dto';
import type {
  ConnectionTestOutcome,
  ConnectionTestView,
  DataSourceKind,
  DataSourceStatus,
  DataSourceWithDatasetsView,
} from '../../application/contracts/data-source-views';

/** JSON-safe shapes the UI receives: dates as ISO-8601 strings. */
export interface DataSourceDto {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly status: DataSourceStatus;
  readonly endpoint: string | null;
  readonly lastCheckedAt: string | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly datasets: readonly DatasetDto[];
}

export function toDataSourceDto(view: DataSourceWithDatasetsView): DataSourceDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    name: view.name,
    kind: view.kind,
    status: view.status,
    endpoint: view.endpoint,
    lastCheckedAt: view.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: view.lastErrorCode,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
    datasets: view.datasets.map(toDatasetDto),
  };
}

export interface ConnectionTestDto {
  readonly dataSourceId: string;
  readonly outcome: ConnectionTestOutcome;
}

export function toConnectionTestDto(view: ConnectionTestView): ConnectionTestDto {
  return { dataSourceId: view.dataSourceId, outcome: view.outcome };
}
