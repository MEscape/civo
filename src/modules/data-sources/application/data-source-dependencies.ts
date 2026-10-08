import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { ContentHasher } from '../domain/ports/content-hasher.port';
import type { DataSourceAuditLog } from '../domain/ports/data-source-audit-log.port';
import type { DataSourceConnector } from '../domain/ports/data-source-connector.port';
import type { DataSourceRepository } from '../domain/ports/data-source.repository';
import type { DatasetRepository } from '../domain/ports/dataset.repository';

/** What every protected data-source use case is built from. */
export interface DataSourceDependencies {
  readonly authorization: AuthorizationService;
  readonly dataSources: DataSourceRepository;
  readonly datasets: DatasetRepository;
  readonly audit: DataSourceAuditLog;
  readonly clock: Clock;
}

/** Use cases that call the external system (test, discover, preview, save mapping). */
export interface ConnectedDataSourceDependencies extends DataSourceDependencies {
  readonly connector: DataSourceConnector;
}

/** The public site has no actor, so it gets no authorization service. */
export interface PublicDatasetDependencies {
  readonly datasets: DatasetRepository;
  readonly connector: DataSourceConnector;
  readonly hasher: ContentHasher;
}
