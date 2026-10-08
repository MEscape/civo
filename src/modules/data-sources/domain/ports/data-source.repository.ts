import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { DataSource, DataSourceDraft } from '../models/data-source';
import type { DataSourceStatus } from '../models/data-source-kinds';
import type { Dataset } from '../models/dataset';
import type { WebsiteId, DataSourceId } from '../models/ids';

export interface DataSourceWithDatasets {
  readonly source: DataSource;
  readonly datasets: readonly Dataset[];
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
export interface DataSourceRepository {
  findById(
    id: DataSourceId,
    tenantId: TenantId,
  ): AppResultAsync<DataSource | null, InfrastructureAppError>;

  /** Bounded: never returns more than `limit` items (performance.md). */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly DataSource[], InfrastructureAppError>;

  /** Bounded twice: at most `sources` sources and `datasetsPerSource` datasets each. */
  listWithDatasets(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limits: { readonly sources: number; readonly datasetsPerSource: number },
  ): AppResultAsync<readonly DataSourceWithDatasets[], InfrastructureAppError>;

  /** `NotFoundAppError` when the website does not exist in the tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: DataSourceDraft;
  }): AppResultAsync<DataSource, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent. Datasets of the source go with it. */
  deleteById(id: DataSourceId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;

  recordTestResult(
    id: DataSourceId,
    tenantId: TenantId,
    outcome: TestOutcome,
  ): AppResultAsync<void, NotFoundAppError | InfrastructureAppError>;
}
