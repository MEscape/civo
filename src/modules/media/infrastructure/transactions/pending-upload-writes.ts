import type { TenantId } from '@modules/auth';

import { advisoryLock, dateToInstant, db, retryTransient } from '@lib/db';

import { MEDIA_SELECT, toStoredVisibility } from '../prisma/media-asset-record-mapper';

import type { NewPendingAsset, PendingQuota } from '../../domain/ports/media-asset.repository';
import type { MediaAssetRecord } from '../prisma/media-asset-record-mapper';

/**
 * Stores a new PENDING asset unless the tenant already holds `quota.maxOpen` live unfinished
 * uploads, in one transaction under a per-tenant lock: counting and inserting happen together, so
 * simultaneous requests cannot each see room for the last slot. `null`: the quota is used up.
 * Retried as a whole when the database aborts it as a deadlock or serialization failure.
 *
 * `id` and `objectKey` are minted by the caller from trusted values; no client value reaches a key.
 */
export function insertPendingWithinQuota(
  input: NewPendingAsset & { readonly id: string; readonly objectKey: string },
  quota: PendingQuota,
): Promise<MediaAssetRecord | null> {
  const tenantId: TenantId = input.tenantId;

  return retryTransient(() =>
    db.transaction(async (tx) => {
      await advisoryLock(tx, `media:${tenantId}`);
      const open = await tx.orm.public.MediaAsset.where({ tenantId, status: 'PENDING' })
        .where((asset) => asset.uploadExpiresAt.gt(dateToInstant(quota.now)))
        .aggregate((aggregate) => ({ total: aggregate.count() }));
      if (open.total >= quota.maxOpen) {
        return null;
      }
      return tx.orm.public.MediaAsset.select(...MEDIA_SELECT).create({
        id: input.id,
        tenantId,
        // A tenant is its website: the one id serves as both (`Website_tenant_is_website_check`, and the foreign key names the pair).
        websiteId: tenantId,
        objectKey: input.objectKey,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        byteSize: input.byteSize,
        visibility: toStoredVisibility(input.visibility),
        status: 'PENDING',
        createdBy: input.createdBy,
        uploadExpiresAt: dateToInstant(input.uploadExpiresAt),
      });
    }),
  );
}
