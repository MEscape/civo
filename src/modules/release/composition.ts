import 'server-only';

import { cache } from 'react';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';
import {
  getBuilderQueries,
  datasetUsesInStoredPage,
  listPagesForRelease,
  restoreStoredPageConfig,
  savedMapIdsInStoredPage,
  savePageDraft,
} from '@modules/builder';
import { getComponentPlatformQueries } from '@modules/component-platform';
import {
  authorizeDataRemoval,
  datasetInUse,
  deleteDataSourceGuarded,
  deleteDatasetGuarded,
  invalidateDatasetConsumers,
  invalidateRemovedDataSource,
} from '@modules/data-sources';
import {
  deleteMapGuarded,
  getMapQueries,
  invalidateMapScreens,
  listMapsForRelease,
} from '@modules/map';
import { getWebsiteQueries } from '@modules/website';

import { systemClock } from '@lib/clock';
import { getRateLimiter } from '@lib/rate-limit';
import { once } from '@lib/utils';

import { ApplyMigration } from './application/commands/apply-migration';
import { DeleteUnusedData } from './application/commands/delete-unused-data';
import { DeleteUnusedMap } from './application/commands/delete-unused-map';
import { ProposeMigration } from './application/commands/propose-migration';
import { PublishRelease } from './application/commands/publish-release';
import { RollbackRelease } from './application/commands/rollback-release';
import { FindWebsitesUsingComponent } from './application/queries/find-websites-using-component';
import { GetMigration } from './application/queries/get-migration';
import { GetPublicationStatus } from './application/queries/get-publication-status';
import { GetPublishedSnapshot } from './application/queries/get-published-snapshot';
import { GetReleasePreview } from './application/queries/get-release-preview';
import { ListLiveDatasetUsage } from './application/queries/list-live-dataset-usage';
import { ListLiveMapUsage } from './application/queries/list-live-map-usage';
import { ListMigrations } from './application/queries/list-migrations';
import { ListReleases } from './application/queries/list-releases';
import { AuthReleaseAccess } from './infrastructure/access/auth-release-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerReleaseAuditLog,
} from './infrastructure/audit/logger-release-audit-log';
import { PrismaMigrationRepository } from './infrastructure/prisma/prisma-migration.repository';
import { PrismaReleaseRepository } from './infrastructure/prisma/prisma-release.repository';
import { BuilderPageSource } from './infrastructure/source/builder-page-source';
import { ComponentPlatformCatalog } from './infrastructure/source/component-platform-catalog';
import { DataSourcesModuleSource } from './infrastructure/source/data-sources-module-source';
import { MapModuleSource } from './infrastructure/source/map-module-source';
import { WebsiteModuleSource } from './infrastructure/source/website-module-source';

import type { ReleaseReaders } from './application/contracts/screen-views';
import type {
  DeleteUnusedDataDependencies,
  DeleteUnusedMapDependencies,
  MigrationDependencies,
  PublishReleaseDependencies,
} from './application/release-dependencies';
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
const getReleases = once(() => new PrismaReleaseRepository());

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerReleaseAuditLog, {
  source: 'release',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

/** Dependencies and adapters are built once, when a release capability is first requested. */
const getDependencies = once<
  PublishReleaseDependencies &
    MigrationDependencies &
    DeleteUnusedDataDependencies &
    DeleteUnusedMapDependencies
>(() => ({
  authorization: getAccessControl(),
  access: new AuthReleaseAccess(getAuthQueries, getAccessControl()),
  rateLimiter: getRateLimiter(),
  websites: new WebsiteModuleSource((id) => getWebsiteQueries().getWebsiteById.execute(id)),
  releases: getReleases(),
  migrations: new PrismaMigrationRepository(),
  audit: auditLog,
  pages: new BuilderPageSource(listPagesForRelease, restoreStoredPageConfig, savePageDraft),
  components: new ComponentPlatformCatalog(
    (type) => getComponentPlatformQueries().getComponentReleaseInfo.execute(type),
    (type, version) =>
      getComponentPlatformQueries().getComponentDefaultProps.execute({ type, version }),
  ),
  maps: new MapModuleSource({
    listMaps: listMapsForRelease,
    mapIdsInStoredPage: savedMapIdsInStoredPage,
    deleteMap: deleteMapGuarded,
  }),
  clock: systemClock,
  data: new DataSourcesModuleSource({
    authorizeRemoval: authorizeDataRemoval,
    mapUsage: (websiteId) => getMapQueries().getMapDatasetUsage.execute(websiteId),
    usesInStoredPage: datasetUsesInStoredPage,
    draftUsage: (websiteId) => getBuilderQueries().listDatasetUsage.execute(websiteId),
    inUse: datasetInUse,
    deleteDataset: deleteDatasetGuarded,
    deleteDataSource: deleteDataSourceGuarded,
  }),
}));

export const getReleaseCommands = once(() => {
  const dependencies = getDependencies();
  return {
    publishRelease: new PublishRelease(dependencies),
    rollbackRelease: new RollbackRelease(dependencies),
    proposeMigration: new ProposeMigration(dependencies),
    deleteUnusedData: new DeleteUnusedData(dependencies),
    deleteUnusedMap: new DeleteUnusedMap(dependencies),
    applyMigration: new ApplyMigration(dependencies),
  } as const;
});

export const getReleaseQueries = once(() => {
  const dependencies = getDependencies();
  return {
    getPublicationStatus: new GetPublicationStatus(dependencies),
    getReleasePreview: new GetReleasePreview(dependencies),
    listReleases: new ListReleases(dependencies),
    getPublishedSnapshot: new GetPublishedSnapshot({ releases: getReleases() }),
    findWebsitesUsingComponent: new FindWebsitesUsingComponent(dependencies),
    listMigrations: new ListMigrations(dependencies),
    getMigration: new GetMigration(dependencies),
    listLiveDatasetUsage: new ListLiveDatasetUsage(dependencies),
    listLiveMapUsage: new ListLiveMapUsage(dependencies),
  } as const;
});

/**
 * Where a website stands before publishing. Read once per request: the bar above every page
 * of the website and the release screen under it share the one answer.
 */
export const loadPublicationStatus = cache((websiteId: string) =>
  getReleaseQueries().getPublicationStatus.execute(websiteId),
);

/**
 * What the release screens read with. The names of those who published come from the auth
 * module, wired here so the screens never import another module's server side.
 */
export const getReleaseScreenQueries = once((): ReleaseReaders => ({
  ...getReleaseQueries(),
  getPublicationStatus: { execute: loadPublicationStatus },
  resolveMemberNames: (memberIds) => getAuthQueries().resolveMemberNames.execute(memberIds),
}));

/**
 * Compatibility facade for consumers outside this module; every getter is the same lazy query
 * `getReleaseQueries()` hands out.
 *
 * @keep read by routes of the application, which this module cannot see
 */
export const releaseQueries = {
  get getPublicationStatus() {
    return getReleaseQueries().getPublicationStatus;
  },
  get getPublishedSnapshot() {
    return getReleaseQueries().getPublishedSnapshot;
  },
  get findWebsitesUsingComponent() {
    return getReleaseQueries().findWebsitesUsingComponent;
  },
  get getMigration() {
    return getReleaseQueries().getMigration;
  },
  get listLiveDatasetUsage() {
    return getReleaseQueries().listLiveDatasetUsage;
  },
  get listLiveMapUsage() {
    return getReleaseQueries().listLiveMapUsage;
  },
};

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

/** Refreshes the maps screens after a map was deleted, through the map module's own invalidation. */
export function invalidateRemovedMap(websiteId: string, mapId: string): void {
  invalidateMapScreens(websiteId, mapId);
}
