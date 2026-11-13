import type { TenantId } from '@modules/auth';

import { ResultAsync, ok, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_SECOND } from '@lib/utils';

import { MEDIA_LIMITS } from '../../domain/models/media-asset';

import { locationOf, requireStore } from './media-store';

import type { MediaAsset } from '../../domain/models/media-asset';
import type { MediaDependencies } from '../media-dependencies';

/**
 * Clears uploads that were started and never finished, plus deletions that stalled, for one
 * website. There is no job queue: it rides along with the next upload request, a few files at a
 * time, so a website that uploads keeps itself tidy and one that does not has nothing to clear.
 *
 * It never fails its caller. Whatever cannot be removed stays DELETING (hidden) and is claimed
 * again by a later sweep once its lease has run out, with a `media.cleanup_failed` record.
 */
export function sweepAbandonedUploads(
  deps: MediaDependencies,
  tenantId: TenantId,
): AppResultAsync<null, never> {
  const { assets, clock } = deps;
  const now = clock.now();
  const staleBefore = new Date(now.getTime() - MEDIA_LIMITS.pendingLifetimeSeconds * MS_PER_SECOND);

  return assets
    .claimAbandoned({ tenantId, now, staleBefore, limit: MEDIA_LIMITS.sweepBatch })
    .andThen((claimed) => clearAll(deps, claimed))
    .orElse((error) => {
      deps.audit.record({
        type: 'media.cleanup_failed',
        tenantId,
        errorCode: error.code,
      });
      return okAsync(null);
    });
}

async function clearOne(deps: MediaDependencies, asset: MediaAsset): Promise<void> {
  const { assets, audit } = deps;
  const failed = (errorCode: string) => {
    audit.record({
      type: 'media.cleanup_failed',
      tenantId: asset.tenantId,
      assetId: asset.id,
      errorCode,
    });
  };

  const store = requireStore(deps, asset.visibility);
  if (store.isErr()) {
    failed(store.error.code);
    return;
  }

  const removed = await store.value.delete(locationOf(asset));
  if (removed.isErr()) {
    failed(removed.error.code);
    return;
  }

  const dropped = await assets.deleteById(asset.id, asset.tenantId);
  if (dropped.isErr()) {
    failed(dropped.error.code);
    return;
  }
  audit.record({ type: 'media.abandoned_removed', tenantId: asset.tenantId, assetId: asset.id });
}

function clearAll(
  deps: MediaDependencies,
  claimed: readonly MediaAsset[],
): AppResultAsync<null, never> {
  return new ResultAsync(
    (async () => {
      for (const asset of claimed) {
        await clearOne(deps, asset);
      }
      return ok(null);
    })(),
  );
}
