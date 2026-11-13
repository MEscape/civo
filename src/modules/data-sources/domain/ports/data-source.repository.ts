import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { DatasetDeletionGuard, DeletionGuardError } from './dataset-deletion-guard.port';
import type { DataSource, DataSourceChanges, DataSourceDraft } from '../models/data-source';
import type { DataSourceStatus } from '../models/data-source-kinds';
import type { Dataset } from '../models/dataset';
import type { WebsiteId, DataSourceId, DatasetId } from '../models/ids';

export interface DataSourceWithDatasets {
  readonly source: DataSource;
  readonly datasets: readonly Dataset[];
  readonly isDatasetListTruncated: boolean;
}

export interface TestOutcome {
  readonly status: Extract<DataSourceStatus, 'OK' | 'ERROR'>;
  /** A stable error code, never prose or a raw exception message. */
  readonly errorCode: string | null;
  readonly checkedAt: Date;
}

/**
 * Persistence for data sources. A source belongs to a website and a website
 * to a tenant, so EVERY tenant-owned read and write takes the tenant and
 * matches on it: another tenant's id behaves exactly like an id that does
 * not exist. Lists are bounded.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
/** Which sources to read, and how many datasets of each. */
export interface DataSourceListSlice {
  readonly page: PageRequest;
  readonly datasetsPerSource: number;
}

export interface DataSourceRepository {
  /** Routing metadata only; authenticate first, then authorize this website before reading the source. */
  findWebsiteId(id: DataSourceId): AppResultAsync<WebsiteId | null, InfrastructureAppError>;

  /** The source's deterministic list position, so a saved source is visible even beyond the first page. */
  pageOfSource(input: {
    readonly websiteId: WebsiteId;
    readonly tenantId: TenantId;
    readonly sourceId: DataSourceId;
    readonly pageSize: number;
  }): AppResultAsync<number | null, InfrastructureAppError>;

  findById(
    id: DataSourceId,
    tenantId: TenantId,
  ): AppResultAsync<DataSource | null, InfrastructureAppError>;

  /** The names of those of `ids` that are sources of the website; nothing else is read. */
  findNames(
    websiteId: WebsiteId,
    tenantId: TenantId,
    ids: readonly DataSourceId[],
  ): AppResultAsync<
    ReadonlyArray<{ readonly id: DataSourceId; readonly name: string }>,
    InfrastructureAppError
  >;

  /** Bounded: never returns more than `limit` items (performance.md). */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<
    { readonly items: readonly DataSource[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** One page of sources, oldest first, each with at most `datasetsPerSource` datasets. */
  listWithDatasets(
    websiteId: WebsiteId,
    tenantId: TenantId,
    slice: DataSourceListSlice,
  ): AppResultAsync<Page<DataSourceWithDatasets>, InfrastructureAppError>;

  /** `NotFoundAppError` when the website does not exist in the tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DataSourceDraft;
  }): AppResultAsync<DataSource, NotFoundAppError | InfrastructureAppError>;

  /**
   * Stores a validated edit. `resetsCheck` (a changed connection) clears the last test, so the
   * source reads as untested until it is tested again.
   */
  update(
    id: DataSourceId,
    tenantId: TenantId,
    changes: DataSourceChanges & { readonly resetsCheck: boolean },
  ): AppResultAsync<DataSource, NotFoundAppError | InfrastructureAppError>;

  /** Checks every stored child before cascading; incomplete enumeration refuses deletion. */
  deleteGuarded(
    id: DataSourceId,
    tenantId: TenantId,
    guard: DatasetDeletionGuard,
  ): AppResultAsync<readonly DatasetId[], DeletionGuardError>;

  recordTestResult(
    id: DataSourceId,
    tenantId: TenantId,
    outcome: TestOutcome,
  ): AppResultAsync<void, NotFoundAppError | InfrastructureAppError>;
}
