import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { ComponentCatalog } from '../domain/ports/component-catalog.port';
import type { MigrationRepository } from '../domain/ports/migration.repository';
import type { PageSource } from '../domain/ports/page-source.port';
import type { ReleaseAuditLog } from '../domain/ports/release-audit-log.port';
import type { ReleaseRepository } from '../domain/ports/release.repository';
import type { WebsiteSource } from '../domain/ports/website-source.port';

/** What every protected release use case is built from. */
export interface ReleaseDependencies {
  readonly authorization: AuthorizationService;
  readonly websites: WebsiteSource;
  readonly releases: ReleaseRepository;
  readonly audit: ReleaseAuditLog;
}

/** Publishing also reads the pages and the component registry, and stamps a time. */
export interface PublishReleaseDependencies extends ReleaseDependencies {
  readonly pages: PageSource;
  readonly components: ComponentCatalog;
  readonly clock: Clock;
}

/** The public site has no actor, so it gets no authorization service. */
export interface PublicReleaseDependencies {
  readonly releases: ReleaseRepository;
}

/** What every migration use case adds: where plans are kept. */
export interface MigrationDependencies extends ReleaseDependencies {
  readonly migrations: MigrationRepository;
}

/** Proposing reads the live release's trees and the component registry. */
export interface ProposeMigrationDependencies extends MigrationDependencies {
  readonly pages: PageSource;
  readonly components: ComponentCatalog;
}

/** Applying re-reads the live release, writes drafts through the builder and stamps a time. */
export interface ApplyMigrationDependencies extends MigrationDependencies {
  readonly pages: PageSource;
  readonly clock: Clock;
}
