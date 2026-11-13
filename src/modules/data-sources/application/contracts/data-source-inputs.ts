import type { DatasetMappingInput } from '../../domain/mapping/dataset-mapping';
import type { DataSourceChangesInput, DataSourceDraftInput } from '../../domain/models/data-source';
import type { DatasetChangesInput, DatasetDraftInput } from '../../domain/models/dataset';

export type { DatasetMappingInput };

export interface ListDataSourcesWithDatasetsOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
  readonly sourceId?: unknown;
}

export type CreateDataSourceInput = DataSourceDraftInput;

export interface UpdateDataSourceInput extends DataSourceChangesInput {
  readonly dataSourceId: string;
}

export interface CreateDatasetInput extends DatasetDraftInput {
  readonly dataSourceId: string;
}

export interface UpdateDatasetInput extends DatasetChangesInput {
  readonly datasetId: string;
}

export interface SaveDatasetMappingInput {
  readonly datasetId: string;
  readonly mapping: DatasetMappingInput;
}

export type PreviewDatasetMappingInput = SaveDatasetMappingInput;
