import { toActorId, toTenantId } from '@modules/auth';
import type { DatasetDeletionGuard, authorizeDataRemoval } from '@modules/data-sources';

import type { AppError, ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { errAsync, okAsync } from '@lib/result';

import { releaseSourceFailed } from '../../domain/errors/release-errors';
import { toDataSourceId, toDatasetId, toWebsiteId } from '../../domain/models/ids';

import type { DataSourceId, DatasetId, WebsiteId } from '../../domain/models/ids';
import type {
  DataRemoval,
  DataRemovalError,
  DataRemovalGuard,
  DataSourcePort,
  DataRemovalAuthority,
} from '../../domain/ports/data-source.port';

interface RemovedDataset {
  readonly id: string;
  readonly websiteId: string;
}

interface RemovedDataSource extends RemovedDataset {
  readonly removedDatasetIds: readonly string[];
}

/** The data module's refusals pass through; anything else is another module failing. */
function toRemovalError(error: AppError): DataRemovalError {
  switch (error.kind) {
    case 'unauthorized':
    case 'forbidden':
    case 'validation':
    case 'not_found':
    case 'conflict':
    case 'infrastructure':
      return error;
    default:
      return releaseSourceFailed(error);
  }
}

/** The data module's deletions and the builder's page readers, as this module's port. */
export class DataSourcesModuleSource implements DataSourcePort {
  constructor(
    private readonly modules: {
      readonly authorizeRemoval: typeof authorizeDataRemoval;
      readonly usesInStoredPage: (stored: unknown) => ReadonlyArray<{ readonly datasetId: string }>;
      readonly draftUsage: (websiteId: string) => AppResultAsync<{
        readonly byDataset: Readonly<Record<string, unknown>>;
        readonly isTruncated: boolean;
      }>;
      readonly mapUsage: (
        websiteId: string,
      ) => AppResultAsync<{ readonly datasetIds: readonly string[] }>;
      readonly inUse: () => ConflictAppError;
      readonly deleteDataset: (
        id: string,
        guard: DatasetDeletionGuard,
      ) => AppResultAsync<RemovedDataset>;
      readonly deleteDataSource: (
        id: string,
        guard: DatasetDeletionGuard,
      ) => AppResultAsync<RemovedDataSource>;
    },
  ) {}

  authorizeRemoval(
    kind: 'dataset' | 'source',
    id: DatasetId | DataSourceId,
  ): AppResultAsync<DataRemovalAuthority, DataRemovalError> {
    return this.modules
      .authorizeRemoval({ kind, id })
      .mapErr(toRemovalError)
      .map((scope) => ({
        websiteId: toWebsiteId(scope.websiteId),
        actor: { id: toActorId(scope.actorId), tenantId: toTenantId(scope.tenantId) },
      }));
  }

  datasetsInStoredPage(stored: unknown): ReadonlySet<DatasetId> {
    return new Set(this.modules.usesInStoredPage(stored).map((use) => toDatasetId(use.datasetId)));
  }

  datasetsInDrafts(websiteId: WebsiteId): AppResultAsync<ReadonlySet<DatasetId>> {
    return this.modules
      .draftUsage(websiteId)
      .andThen((usage) =>
        usage.isTruncated
          ? errAsync(releaseSourceFailed('Draft dataset usage is incomplete.'))
          : okAsync(new Set(Object.keys(usage.byDataset).map(toDatasetId))),
      );
  }

  datasetsInMaps(websiteId: WebsiteId): AppResultAsync<ReadonlySet<DatasetId>> {
    return this.modules
      .mapUsage(websiteId)
      .map((usage) => new Set(usage.datasetIds.map(toDatasetId)));
  }

  inUse(): ConflictAppError {
    return this.modules.inUse();
  }

  deleteDataset(
    id: DatasetId,
    guard: DataRemovalGuard,
  ): AppResultAsync<DataRemoval, DataRemovalError> {
    return this.modules
      .deleteDataset(id, toModuleGuard(guard))
      .mapErr(toRemovalError)
      .map((removed) => ({
        websiteId: toWebsiteId(removed.websiteId),
        dataSourceId: null,
        datasetIds: [toDatasetId(removed.id)],
      }));
  }

  deleteDataSource(
    id: DataSourceId,
    guard: DataRemovalGuard,
  ): AppResultAsync<DataRemoval, DataRemovalError> {
    return this.modules
      .deleteDataSource(id, toModuleGuard(guard))
      .mapErr(toRemovalError)
      .map((removed) => ({
        websiteId: toWebsiteId(removed.websiteId),
        dataSourceId: toDataSourceId(removed.id),
        datasetIds: removed.removedDatasetIds.map(toDatasetId),
      }));
  }
}

/** The data module asks with plain ids; this module's guard reads them branded. */
function toModuleGuard(guard: DataRemovalGuard): DatasetDeletionGuard {
  return (scope) =>
    guard({
      websiteId: toWebsiteId(scope.websiteId),
      datasetIds: scope.datasetIds.map(toDatasetId),
    });
}
