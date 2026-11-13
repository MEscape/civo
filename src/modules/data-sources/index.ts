/**
 * Server-side public API of the data-sources module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

export {
  authorizeDataRemoval,
  getDataSourceQueries,
  dataSourceQueries,
  deleteDataSourceGuarded,
  deleteDatasetGuarded,
} from './composition';
export {
  invalidateDatasetConsumers,
  invalidateRemovedDataSource,
} from './presentation/cache/invalidate';
export { datasetInUse } from './domain/errors/data-source-errors';
export { READ_WINDOW_LIMITS } from './application/contracts/data-source-constraints';
export type {
  DatasetDeletionGuard,
  DeletionScope,
} from './application/contracts/data-removal-inputs';

export { dataSourceRoutes } from './presentation/routes';
export type {
  ComponentAwaitingData,
  DatasetUse,
  DatasetUsage,
} from './presentation/dto/dataset-usage-dto';
export { DataSourceDetailAdministration } from './presentation/components/sources/data-source-detail-administration';
export { DataSourcesAdministration } from './presentation/components/sources/data-sources-administration';
export { DataSourceFormAdministration } from './presentation/components/sources/data-source-form-administration';
export { DatasetFormAdministration } from './presentation/components/datasets/dataset-form-administration';
export { DatasetMappingAdministration } from './presentation/components/mapping/dataset-mapping-administration';

export type { CanonicalKind, MappedRecordsView } from './application/contracts/dataset-views';
export type { MappedRecordsRequest } from './application/queries/get-mapped-dataset-records';

export { default as enDataSource } from './presentation/i18n/en.json';
export { default as deDataSource } from './presentation/i18n/de.json';
export { DataSourcesOverviewTile } from './presentation/components/sources/data-sources-overview-tile';
