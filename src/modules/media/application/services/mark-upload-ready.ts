import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mediaNotFound } from '../../domain/errors/media-errors';

import type { MediaAsset } from '../../domain/models/media-asset';
import type { MediaScope } from '../../domain/ports/media-access.port';
import type { MediaDependencies } from '../media-dependencies';

type ReadyError = NotFoundAppError | InfrastructureAppError;

/**
 * The conditional write: only a still-PENDING asset becomes READY, so two finalisations at once
 * (a double click, two tabs) cannot both win. The loser sees the winner's READY asset and succeeds;
 * an asset that was deleted in between is gone.
 */
export function markUploadReady(
  deps: MediaDependencies,
  scope: MediaScope,
  asset: MediaAsset,
): AppResultAsync<MediaAsset, ReadyError> {
  const { assets, audit, clock } = deps;
  return assets
    .markReady(asset.id, asset.tenantId, clock.now())
    .andThen((ready): AppResultAsync<MediaAsset, ReadyError> => {
      if (ready !== null) {
        return okAsync(ready);
      }
      // Someone else finalised (or deleted) it between our read and our write.
      return assets
        .findById(asset.id, asset.tenantId)
        .andThen((current) =>
          current?.status === 'ready' ? okAsync(current) : errAsync(mediaNotFound()),
        );
    })
    .map((ready) => {
      audit.record({
        type: 'media.upload_completed',
        actorId: scope.actorId,
        tenantId: asset.tenantId,
        assetId: asset.id,
      });
      return ready;
    });
}
