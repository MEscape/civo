import type { ActorId, TenantId } from '@modules/auth';

import type { PageId, WebsiteId } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: ids, counts and codes
 * only, never titles, props or text.
 */
export type BuilderEvent =
  | {
      readonly type: 'page.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly pageId: PageId;
      readonly websiteId: WebsiteId;
    }
  | {
      readonly type: 'page.system_created';
      readonly tenantId: TenantId;
      readonly pageId: PageId;
      readonly websiteId: WebsiteId;
    }
  | {
      readonly type: 'page.config_saved';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly pageId: PageId;
      readonly websiteId: WebsiteId;
      readonly version: number;
      readonly nodeCount: number;
    }
  | {
      /** A save that tried to exceed the editor's capabilities: a security signal. */
      readonly type: 'page.edit_scope_violation';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly pageId: PageId;
      readonly errorCode: string;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface BuilderAuditLog {
  record(event: BuilderEvent): void;
}
