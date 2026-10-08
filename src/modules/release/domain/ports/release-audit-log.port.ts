import type { ActorId, TenantId } from '@modules/auth';

import type { MigrationId, ReleaseId, WebsiteId } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: ids, numbers and field
 * names only, never titles, page configs, props or resolutions. Adding a variant forces the
 * sink's level table to be updated.
 */
export type ReleaseEvent =
  | {
      readonly type: 'release.published';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly releaseId: ReleaseId;
      readonly releaseNumber: number;
    }
  | {
      readonly type: 'release.rolled_back';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly releaseId: ReleaseId;
      readonly releaseNumber: number;
      readonly previousReleaseId: ReleaseId | null;
    }
  | {
      readonly type: 'release.publish_blocked';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      /** The `fieldErrors` keys: page and component names, no content. */
      readonly fields: readonly string[];
    }
  | {
      readonly type: 'release.migration_proposed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly migrationId: MigrationId;
      readonly sourceReleaseId: ReleaseId;
      readonly needsReviewCount: number;
      readonly unresolvableCount: number;
    }
  | {
      readonly type: 'release.migration_applied';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly migrationId: MigrationId;
      readonly writtenPageCount: number;
      readonly skippedNodeCount: number;
    }
  | {
      /** Some pages could not be written; the migration stays proposed so it can be retried. */
      readonly type: 'release.migration_apply_incomplete';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly migrationId: MigrationId;
      readonly failedPageCount: number;
      readonly divergedPageCount: number;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface ReleaseAuditLog {
  record(event: ReleaseEvent): void;
}
