import 'server-only';
import { withAuditTrail } from '@modules/audit';
import { getAccessControl } from '@modules/auth';
import {
  builderQueries,
  datasetUsesInStoredPage,
  listPagesForRelease,
  restoreStoredPageConfig,
  savePageDraft,
} from '@modules/builder';
import { componentPlatformQueries } from '@modules/component-platform';
import {
  datasetInUse,
  deleteDataSourceGuarded,
  deleteDatasetGuarded,
  invalidateDatasetConsumers,
  invalidateRemovedDataSource,
} from '@modules/data-sources';
import { websiteQueries } from '@modules/website';

import { systemClock } from '@lib/clock';

import { ApplyMigration } from './application/commands/apply-migration';
import { DeleteUnusedData } from './application/commands/delete-unused-data';
import { ProposeMigration } from './application/commands/propose-migration';
import { PublishRelease } from './application/commands/publish-release';
import { RollbackRelease } from './application/commands/rollback-release';
import { FindWebsitesUsingComponent } from './application/queries/find-websites-using-component';
import { GetMigration } from './application/queries/get-migration';
import { GetPublicationStatus } from './application/queries/get-publication-status';
import { GetPublishedSnapshot } from './application/queries/get-published-snapshot';
import { GetReleasePreview } from './application/queries/get-release-preview';
import { ListLiveDatasetUsage } from './application/queries/list-live-dataset-usage';
import { ListMigrations } from './application/queries/list-migrations';
import { ListReleases } from './application/queries/list-releases';
import { ComponentPlatformCatalog } from './infrastructure/component-platform/component-platform-catalog';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerReleaseAuditLog,
} from './infrastructure/logging/logger-release-audit-log';
import { PrismaMigrationRepository } from './infrastructure/prisma/prisma-migration.repository';
import { PrismaReleaseRepository } from './infrastructure/prisma/prisma-release.repository';
import { BuilderPageSource } from './infrastructure/source/builder-page-source';
import { DataSourcesModuleSource } from './infrastructure/source/data-sources-module-source';
import { WebsiteModuleSource } from './infrastructure/source/website-module-source';

import type { DataRemoval } from './domain/ports/data-source.port';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error.
 *
 * Publishing and migrating a release are one capability of one module, so
 * they share every adapter: each neighbour (website, builder, component
 * registry) is wired exactly ONCE below, through its public API and behind
 * a port. A change in a neighbour is a change to exactly one adapter.
 */
const releases = new PrismaReleaseRepository();

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerReleaseAuditLog, {
  source: 'release',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

const dependencies = {
  authorization: getAccessControl(),
  websites: new WebsiteModuleSource((id) => websiteQueries.getWebsiteById.execute(id)),
  releases,
  audit: auditLog,
};

const migrationDependencies = {
  ...dependencies,
  migrations: new PrismaMigrationRepository(),
};

const pages = new BuilderPageSource(listPagesForRelease, restoreStoredPageConfig, savePageDraft);

const components = new ComponentPlatformCatalog(
  (type) => componentPlatformQueries.getComponentReleaseInfo.execute(type),
  (type, version) => componentPlatformQueries.getComponentDefaultProps.execute({ type, version }),
);

const clock = systemClock;

const dataDependencies = {
  ...dependencies,
  data: new DataSourcesModuleSource({
    usesInStoredPage: datasetUsesInStoredPage,
    draftUsage: (websiteId) =>
      builderQueries.listDatasetUsage.execute(websiteId).map((usage) => usage.byDataset),
    inUse: datasetInUse,
    deleteDataset: deleteDatasetGuarded,
    deleteDataSource: deleteDataSourceGuarded,
  }),
};

/** Publishing, and reading where a website stands before it, work from the same pages and components. */
const publishDependencies = { ...dependencies, pages, components, clock };

/** The only place adapters are chosen. Everything else sees ports. */
export const releaseCommands = {
  publishRelease: new PublishRelease(publishDependencies),
  rollbackRelease: new RollbackRelease(dependencies),
  proposeMigration: new ProposeMigration({
    ...migrationDependencies,
    pages,
    components,
  }),
  deleteUnusedData: new DeleteUnusedData(dataDependencies),
  applyMigration: new ApplyMigration({
    ...migrationDependencies,
    pages,
    clock,
  }),
} as const;

export const releaseQueries = {
  getPublicationStatus: new GetPublicationStatus(publishDependencies),
  getReleasePreview: new GetReleasePreview({ ...dependencies, components }),
  listReleases: new ListReleases(dependencies),
  getPublishedSnapshot: new GetPublishedSnapshot({ releases }),
  findWebsitesUsingComponent: new FindWebsitesUsingComponent(dependencies),
  listMigrations: new ListMigrations(migrationDependencies),
  getMigration: new GetMigration(migrationDependencies),
  listLiveDatasetUsage: new ListLiveDatasetUsage(dataDependencies),
} as const;

/**
 * Refreshes every screen and cache that showed removed data, through the data
 * module's own invalidation. Handed to this module's deletion action; also
 * public, for any route that deletes data through `releaseCommands`.
 */
export function invalidateRemovedData(removal: DataRemoval): void {
  if (removal.dataSourceId === null) {
    removal.datasetIds.forEach((datasetId) => {
      invalidateDatasetConsumers(removal.websiteId, datasetId);
    });
    return;
  }
  invalidateRemovedDataSource(removal.websiteId, removal.dataSourceId, removal.datasetIds);
}
