import type { ActorId, TenantId } from '@modules/auth';

import type { CanonicalKind } from '../models/canonical-kinds';
import type { DataSourceKind } from '../models/data-source-kinds';
import type { WebsiteId, DataSourceId, DatasetId } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: field names and ids only,
 * never names, slugs, URLs, mapping paths or credentials. Adding a variant
 * forces the sink's level table to be updated.
 */
export type DataSourceEvent =
  | {
      readonly type: 'data_source.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly dataSourceId: DataSourceId;
      readonly kind: DataSourceKind;
    }
  | {
      readonly type: 'data_source.tested';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly dataSourceId: DataSourceId;
      readonly outcome: 'OK' | 'ERROR';
      /** A stable error code, never prose or a raw exception message. */
      readonly errorCode: string | null;
    }
  | {
      readonly type: 'data_source.deleted';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly dataSourceId: DataSourceId;
    }
  | {
      readonly type: 'dataset.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly dataSourceId: DataSourceId;
      readonly datasetId: DatasetId;
      readonly canonicalKind: CanonicalKind;
    }
  | {
      readonly type: 'dataset.updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly datasetId: DatasetId;
      readonly changedFields: ReadonlyArray<'name' | 'slug'>;
    }
  | {
      readonly type: 'dataset.mapping_saved';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly datasetId: DatasetId;
    }
  | {
      readonly type: 'dataset.deleted';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly datasetId: DatasetId;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface DataSourceAuditLog {
  record(event: DataSourceEvent): void;
}
