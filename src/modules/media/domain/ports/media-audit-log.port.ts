import type { ActorId, TenantId } from '@modules/auth';

import type { MediaAssetId } from '../models/ids';
import type { MediaVisibility } from '../models/media-asset';

/**
 * Business facts worth keeping: ids and facts, never file names, never a signed URL. Adding a
 * variant forces the sink's level table to be updated.
 */
export type MediaEvent =
  | {
      readonly type: 'media.upload_authorised';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly assetId: MediaAssetId;
      readonly visibility: MediaVisibility;
      readonly byteSize: number;
    }
  | {
      readonly type: 'media.upload_completed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly assetId: MediaAssetId;
    }
  | {
      readonly type: 'media.upload_rejected';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly assetId: MediaAssetId;
      readonly reason: 'size' | 'content_type' | 'signature';
    }
  | {
      readonly type: 'media.deleted';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly assetId: MediaAssetId;
    }
  | {
      /** An upload that was never finished was cleared, object and row. */
      readonly type: 'media.abandoned_removed';
      readonly tenantId: TenantId;
      readonly assetId: MediaAssetId;
    }
  | {
      /** An object or a row could not be removed; it stays findable (status or expiry) for a retry. */
      readonly type: 'media.cleanup_failed';
      readonly tenantId: TenantId;
      /** Absent when the sweep failed before it found any file. */
      readonly assetId?: MediaAssetId;
      readonly errorCode: string;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface MediaAuditLog {
  record(event: MediaEvent): void;
}
