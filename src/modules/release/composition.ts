import 'server-only';
import { getAccessControl } from '@modules/auth';
import { listPagesForRelease, restoreStoredPageConfig, savePageDraft } from '@modules/builder';
import { componentPlatformQueries } from '@modules/component-platform';
import { websiteQueries } from '@modules/website';

import { systemClock } from '@lib/clock';

import { ApplyMigration } from './application/commands/apply-migration';
import { ProposeMigration } from './application/commands/propose-migration';
import { PublishRelease } from './application/commands/publish-release';
import { RollbackRelease } from './application/commands/rollback-release';
import { FindWebsitesUsingComponent } from './application/queries/find-websites-using-component';
import { GetMigration } from './application/queries/get-migration';
import { GetPublishedSnapshot } from './application/queries/get-published-snapshot';
import { ListMigrations } from './application/queries/list-migrations';
import { ListReleases } from './application/queries/list-releases';
import { ComponentPlatformCatalog } from './infrastructure/component-platform/component-platform-catalog';
import { loggerReleaseAuditLog } from './infrastructure/logging/logger-release-audit-log';
import { PrismaMigrationRepository } from './infrastructure/prisma/prisma-migration.repository';
import { PrismaReleaseRepository } from './infrastructure/prisma/prisma-release.repository';
import { BuilderPageSource } from './infrastructure/source/builder-page-source';
import { WebsiteModuleSource } from './infrastructure/source/website-module-source';

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

const dependencies = {
  authorization: getAccessControl(),
  websites: new WebsiteModuleSource((id) => websiteQueries.getWebsiteById.execute(id)),
  releases,
  audit: loggerReleaseAuditLog,
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

/** The only place adapters are chosen. Everything else sees ports. */
export const releaseCommands = {
  publishRelease: new PublishRelease({
    ...dependencies,
    pages,
    components,
    clock,
  }),
  rollbackRelease: new RollbackRelease(dependencies),
  proposeMigration: new ProposeMigration({
    ...migrationDependencies,
    pages,
    components,
  }),
  applyMigration: new ApplyMigration({
    ...migrationDependencies,
    pages,
    clock,
  }),
} as const;

export const releaseQueries = {
  listReleases: new ListReleases(dependencies),
  getPublishedSnapshot: new GetPublishedSnapshot({ releases }),
  findWebsitesUsingComponent: new FindWebsitesUsingComponent(dependencies),
  listMigrations: new ListMigrations(migrationDependencies),
  getMigration: new GetMigration(migrationDependencies),
} as const;
