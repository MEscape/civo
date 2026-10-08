import type { TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { DatasetMapping } from '../mapping/dataset-mapping';
import type { CanonicalKind } from '../models/canonical-kinds';
import type { Dataset, DatasetChanges, DatasetDraft, DatasetWithSource } from '../models/dataset';
import type { WebsiteId, DataSourceId, DatasetId } from '../models/ids';

/**
 * Persistence for datasets. Tenant scoping works as for sources: every
 * tenant-owned read and write takes the tenant, so another tenant's id
 * behaves exactly like an id that does not exist. The one exception is
 * `findWithSourceInWebsite`, which serves the public site and is scoped by
 * WEBSITE instead, because a visitor has no actor. That scope is what stops
 * a page of one website from reading another website's data.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
export interface DatasetRepository {
  findWithSource(
    id: DatasetId,
    tenantId: TenantId,
  ): AppResultAsync<DatasetWithSource | null, InfrastructureAppError>;

  findWithSourceInWebsite(
    id: DatasetId,
    websiteId: WebsiteId,
  ): AppResultAsync<DatasetWithSource | null, InfrastructureAppError>;

  /** Bounded: never returns more than `limit` items (performance.md). */
  listByDataSource(
    dataSourceId: DataSourceId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly Dataset[], InfrastructureAppError>;

  /** Datasets of one or more canonical kinds within a website: the builder's selector. Bounded. */
  listCompatible(query: {
    readonly websiteId: WebsiteId;
    readonly tenantId: TenantId;
    readonly canonicalKinds: readonly CanonicalKind[];
    readonly limit: number;
  }): AppResultAsync<readonly Dataset[], InfrastructureAppError>;

  /**
   * `NotFoundAppError` when the draft's data source does not exist in the
   * tenant; `ConflictAppError` when the slug is taken within that source.
   */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DatasetDraft;
  }): AppResultAsync<Dataset, ConflictAppError | NotFoundAppError | InfrastructureAppError>;

  update(
    id: DatasetId,
    tenantId: TenantId,
    changes: DatasetChanges,
  ): AppResultAsync<Dataset, ConflictAppError | NotFoundAppError | InfrastructureAppError>;

  /**
   * Replaces the mapping. The adapter also resets the dataset's status to
   * UNKNOWN and clears its fetch time, because a new mapping changes what
   * data is valid.
   */
  saveMapping(
    id: DatasetId,
    tenantId: TenantId,
    mapping: DatasetMapping,
  ): AppResultAsync<Dataset, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent. */
  deleteById(id: DatasetId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
