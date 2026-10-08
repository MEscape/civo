import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';

import { CreateDataSource } from './application/commands/create-data-source';
import { CreateDataset } from './application/commands/create-dataset';
import { DeleteDataSource } from './application/commands/delete-data-source';
import { DeleteDataset } from './application/commands/delete-dataset';
import { SaveDatasetMapping } from './application/commands/save-dataset-mapping';
import { TestDataSourceConnection } from './application/commands/test-data-source-connection';
import { UpdateDataset } from './application/commands/update-dataset';
import { DiscoverDataset } from './application/queries/discover-dataset';
import { GetMappedDatasetRecords } from './application/queries/get-mapped-dataset-records';
import { ListCompatibleDatasets } from './application/queries/list-compatible-datasets';
import { ListDataSources } from './application/queries/list-data-sources';
import { ListDataSourcesWithDatasets } from './application/queries/list-data-sources-with-datasets';
import { PreviewDatasetMapping } from './application/queries/preview-dataset-mapping';
import { CachedDataSourceConnector } from './infrastructure/cache/cached-data-source-reader';
import { KindRoutingConnector } from './infrastructure/connector/kind-routing-connector';
import { restJsonConnector } from './infrastructure/connector/rest-json-connector';
import { Sha256ContentHasher } from './infrastructure/hashing/sha256-content-hasher';
import { loggerDataSourceAuditLog } from './infrastructure/logging/logger-data-source-audit-log';
import { PrismaDataSourceRepository } from './infrastructure/prisma/prisma-data-source.repository';
import { PrismaDatasetRepository } from './infrastructure/prisma/prisma-dataset.repository';

import type { DataSourceDependencies } from './application/data-source-dependencies';

/**
 * The module's composition root: the one file that knows both the use cases
 * and their adapters. Presentation and framework entry points reach use
 * cases only through here, so they never import infrastructure.
 * `server-only` turns an accidental import from a Client Component into a
 * build error. This module needs the Node runtime (DNS, crypto).
 *
 * Two read paths, on purpose: admin operations (test, discover, preview,
 * save) always use the live connector; public content reads use the cached
 * reader.
 */
const dataSources = new PrismaDataSourceRepository();
const datasets = new PrismaDatasetRepository();
const hasher = new Sha256ContentHasher();
const authorizationService = getAccessControl();

const dependencies: DataSourceDependencies = {
  authorization: authorizationService,
  audit: loggerDataSourceAuditLog,
  clock: systemClock,
  dataSources,
  datasets,
};

const liveConnector = new KindRoutingConnector(restJsonConnector);

const connectedDependencies = {
  ...dependencies,
  connector: liveConnector,
};

export const dataSourceCommands = {
  createDataSource: new CreateDataSource(dependencies),
  deleteDataSource: new DeleteDataSource(dependencies),
  testDataSourceConnection: new TestDataSourceConnection(connectedDependencies),
  createDataset: new CreateDataset(dependencies),
  updateDataset: new UpdateDataset(dependencies),
  deleteDataset: new DeleteDataset(dependencies),
  saveDatasetMapping: new SaveDatasetMapping(connectedDependencies),
} as const;

export const dataSourceQueries = {
  listDataSources: new ListDataSources(dependencies),
  listDataSourcesWithDatasets: new ListDataSourcesWithDatasets(dependencies),
  listCompatibleDatasets: new ListCompatibleDatasets(dependencies),
  discoverDataset: new DiscoverDataset(connectedDependencies),
  previewDatasetMapping: new PreviewDatasetMapping(connectedDependencies),
  getMappedDatasetRecords: new GetMappedDatasetRecords({
    datasets,
    connector: new CachedDataSourceConnector(liveConnector),
    hasher,
  }),
} as const;
