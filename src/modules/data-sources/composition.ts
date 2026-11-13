import 'server-only';
import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { getRateLimiter } from '@lib/rate-limit';
import { once } from '@lib/utils';

import { CreateDataSource } from './application/commands/create-data-source';
import { CreateDataset } from './application/commands/create-dataset';
import { DeleteDataSource } from './application/commands/delete-data-source';
import { DeleteDataset } from './application/commands/delete-dataset';
import { SaveDatasetMapping } from './application/commands/save-dataset-mapping';
import { TestDataSourceConnection } from './application/commands/test-data-source-connection';
import { UpdateDataSource } from './application/commands/update-data-source';
import { UpdateDataset } from './application/commands/update-dataset';
import { DiscoverDataset } from './application/queries/discover-dataset';
import { GetDataSource } from './application/queries/get-data-source';
import { GetDataSourceSettings } from './application/queries/get-data-source-settings';
import { GetDataSourceSetup } from './application/queries/get-data-source-setup';
import { GetDataset } from './application/queries/get-dataset';
import { GetMappedDatasetRecords } from './application/queries/get-mapped-dataset-records';
import { ListCompatibleDatasets } from './application/queries/list-compatible-datasets';
import { ListDataSources } from './application/queries/list-data-sources';
import { ListDataSourcesWithDatasets } from './application/queries/list-data-sources-with-datasets';
import { PreviewDatasetMapping } from './application/queries/preview-dataset-mapping';
import { ResolveDataNames } from './application/queries/resolve-data-names';
import { loadAuthorizedDataSource } from './application/services/load-authorized-data-source';
import { loadAuthorizedDataset } from './application/services/load-authorized-dataset';
import { AuthDataSourceAccess } from './infrastructure/access/auth-data-source-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerDataSourceAuditLog,
} from './infrastructure/audit/logger-data-source-audit-log';
import { CachedDataSourceConnector } from './infrastructure/cache/cached-data-source-reader';
import { KindRoutingConnector } from './infrastructure/connector/kind-routing-connector';
import { restJsonConnector } from './infrastructure/connector/rest-json-connector';
import { Sha256ContentHasher } from './infrastructure/hashing/sha256-content-hasher';
import { PrismaDataSourceRepository } from './infrastructure/prisma/prisma-data-source.repository';
import { PrismaDatasetRepository } from './infrastructure/prisma/prisma-dataset.repository';

import type { DatasetDeletionGuard } from './application/contracts/data-removal-inputs';
import type {
  ConnectedDataSourceDependencies,
  DataSourceDependencies,
} from './application/data-source-dependencies';

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
const getDataSources = once(() => new PrismaDataSourceRepository());
const getDatasets = once(() => new PrismaDatasetRepository());
const getLiveConnector = once(() => new KindRoutingConnector(restJsonConnector));

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerDataSourceAuditLog, {
  source: 'data-sources',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

const getDependencies = once<DataSourceDependencies>(() => ({
  authorization: getAccessControl(),
  access: new AuthDataSourceAccess(getAuthQueries, getAccessControl()),
  audit: auditLog,
  clock: systemClock,
  dataSources: getDataSources(),
  datasets: getDatasets(),
}));

const getConnectedDependencies = once<ConnectedDataSourceDependencies>(() => ({
  ...getDependencies(),
  connector: getLiveConnector(),
  rateLimiter: getRateLimiter(),
}));

export const getDataSourceCommands = once(() => {
  const dependencies = getDependencies();
  const connectedDependencies = getConnectedDependencies();
  return {
    createDataSource: new CreateDataSource(dependencies),
    updateDataSource: new UpdateDataSource(dependencies),
    deleteDataSource: new DeleteDataSource(dependencies),
    testDataSourceConnection: new TestDataSourceConnection(connectedDependencies),
    createDataset: new CreateDataset(dependencies),
    updateDataset: new UpdateDataset(dependencies),
    deleteDataset: new DeleteDataset(dependencies),
    saveDatasetMapping: new SaveDatasetMapping(connectedDependencies),
  } as const;
});

export const getDataSourceQueries = once(() => {
  const dependencies = getDependencies();
  const connectedDependencies = getConnectedDependencies();
  return {
    getDataSource: new GetDataSource(dependencies),
    getDataSourceSettings: new GetDataSourceSettings(dependencies),
    getDataset: new GetDataset(dependencies),
    getDataSourceSetup: new GetDataSourceSetup(dependencies),
    listDataSources: new ListDataSources(dependencies),
    resolveDataNames: new ResolveDataNames(dependencies),
    listDataSourcesWithDatasets: new ListDataSourcesWithDatasets(dependencies),
    listCompatibleDatasets: new ListCompatibleDatasets(dependencies),
    discoverDataset: new DiscoverDataset(connectedDependencies),
    previewDatasetMapping: new PreviewDatasetMapping(connectedDependencies),
    getMappedDatasetRecords: new GetMappedDatasetRecords({
      datasets: getDatasets(),
      connector: new CachedDataSourceConnector(getLiveConnector()),
      hasher: new Sha256ContentHasher(),
    }),
  } as const;
});

/** Existing server consumers keep the same lazy query API. */
export const dataSourceQueries = {
  get getDataSource() {
    return getDataSourceQueries().getDataSource;
  },
  get getDataset() {
    return getDataSourceQueries().getDataset;
  },
  get getDataSourceSetup() {
    return getDataSourceQueries().getDataSourceSetup;
  },
  get listDataSources() {
    return getDataSourceQueries().listDataSources;
  },
  get resolveDataNames() {
    return getDataSourceQueries().resolveDataNames;
  },
  get listDataSourcesWithDatasets() {
    return getDataSourceQueries().listDataSourcesWithDatasets;
  },
  get listCompatibleDatasets() {
    return getDataSourceQueries().listCompatibleDatasets;
  },
  get discoverDataset() {
    return getDataSourceQueries().discoverDataset;
  },
  get previewDatasetMapping() {
    return getDataSourceQueries().previewDatasetMapping;
  },
  get getMappedDatasetRecords() {
    return getDataSourceQueries().getMappedDatasetRecords;
  },
};

/*
 * Module-to-module deletions: the caller can see the pages this module
 * cannot, so it supplies the guard that keeps data a page shows (see
 * `DatasetDeletionGuard`). Both still authorize the current actor.
 */
export function deleteDatasetGuarded(
  id: string,
  guard: DatasetDeletionGuard,
): ReturnType<DeleteDataset['execute']> {
  return getDataSourceCommands().deleteDataset.execute(id, guard);
}

export function deleteDataSourceGuarded(
  id: string,
  guard: DatasetDeletionGuard,
): ReturnType<DeleteDataSource['execute']> {
  return getDataSourceCommands().deleteDataSource.execute(id, guard);
}

/** Trusted deletion orchestration resolves DELETE authority from stored ownership without requiring READ. */
export function authorizeDataRemoval(input: {
  readonly kind: 'dataset' | 'source';
  readonly id: string;
}) {
  if (input.kind === 'dataset') {
    return loadAuthorizedDataset(getDependencies(), input.id, 'dataset.delete').map(
      ({ scope }) => scope,
    );
  }
  return loadAuthorizedDataSource(getDependencies(), input.id, 'datasource.delete').map(
    ({ scope }) => scope,
  );
}
