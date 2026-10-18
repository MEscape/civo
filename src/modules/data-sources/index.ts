/**
 * Server-side public API of the data-sources module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

export { dataSourceQueries, deleteDataSourceGuarded, deleteDatasetGuarded } from './composition';
export {
  invalidateDatasetConsumers,
  invalidateRemovedDataSource,
} from './presentation/cache/invalidate';
export { datasetInUse } from './domain/errors/data-source-errors';
export type { DatasetDeletionGuard, DeletionScope } from './application/contracts/deletion-inputs';

export { dataSourceRoutes } from './presentation/routes';
export type {
  ComponentAwaitingData,
  DatasetUse,
  DatasetUsage,
} from './presentation/components/dataset-management-item';
export { DataSourcesSettings } from './presentation/components/data-sources-settings';

export type { CanonicalKind, MappedRecordsView } from './application/contracts/data-source-views';
export type { MappedRecordsRequest } from './application/queries/get-mapped-dataset-records';

export { default as enDataSource } from './presentation/i18n/en.json';
export { default as deDataSource } from './presentation/i18n/de.json';
