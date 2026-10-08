import type { ActorId, TenantId } from '@modules/auth';

import type { WebsiteId } from '../models/ids';
import type { TemplateKey } from '../models/website-template';

/**
 * Business facts worth keeping. Free of content: field names and ids only,
 * never names, descriptions or colors. Adding a variant forces the sink's
 * level table to be updated.
 */
export type WebsiteEvent =
  | {
      readonly type: 'website.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly templateKey: TemplateKey;
    }
  | {
      readonly type: 'website.updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly changedFields: ReadonlyArray<'name' | 'description'>;
    }
  | {
      readonly type: 'website.theme_updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
    }
  | {
      readonly type: 'website.provisioning_rollback_failed';
      readonly tenantId: TenantId; // from the stored record
      readonly websiteId: WebsiteId;
      readonly errorCode: string;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface WebsiteAuditLog {
  record(event: WebsiteEvent): void;
}
