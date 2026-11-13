import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mediaInUse } from '../../domain/errors/media-errors';
import { MEDIA_RATE_LIMITS } from '../rate-limits';
import { findMediaAsset } from '../services/find-media-asset';
import { locationOf, requireStore, storageFailure } from '../services/media-store';
import { withinActorLimit } from '../services/within-actor-limit';

import type { MediaAsset } from '../../domain/models/media-asset';
import type { DeleteMediaAssetInput } from '../contracts/media-views';
import type { MediaDependencies, MediaOperationError } from '../media-dependencies';

/**
 * Removes a file, its bytes and its row, which no transaction can do together. So the order is
 * chosen to make every partial failure harmless and retryable:
 *
 *  1. Refuse while the website still uses the file (a page being edited, or ANY release: a
 *     rollback restores an old one).
 *  2. Mark the row DELETING. From now on the file is hidden everywhere, so a half-finished
 *     delete is never a visible broken image.
 *  3. Delete the object (idempotent).
 *  4. Delete the row.
 *
 * A failure after step 2 leaves a hidden DELETING row; deleting again resumes. No object can
 * ever be left in the store without a row that names it.
 */
export class DeleteMediaAsset {
  constructor(private readonly deps: MediaDependencies) {}

  execute(input: DeleteMediaAssetInput): AppResultAsync<void, MediaOperationError> {
    const { access, assets, audit } = this.deps;

    return access
      .authorizeWebsite('media.delete', input.websiteId)
      .andThen(withinActorLimit(this.deps, MEDIA_RATE_LIMITS.deleteAsset))
      .andThen((scope) =>
        findMediaAsset(assets, scope, input.id).andThen((asset) =>
          this.guardUsage(asset)
            .andThen(() => this.remove(asset))
            .map(() => {
              audit.record({
                type: 'media.deleted',
                actorId: scope.actorId,
                tenantId: asset.tenantId,
                assetId: asset.id,
              });
            }),
        ),
      );
  }

  private guardUsage(asset: MediaAsset): AppResultAsync<null, MediaOperationError> {
    // Only a READY file can be in use. A file that is already on its way out was cleared then.
    if (asset.status !== 'ready') {
      return okAsync(null);
    }
    return this.deps.usage
      .isReferenced(asset.tenantId, asset.id)
      .andThen((used): AppResultAsync<null, MediaOperationError> =>
        used ? errAsync(mediaInUse()) : okAsync(null),
      );
  }

  private remove(asset: MediaAsset): AppResultAsync<void, MediaOperationError> {
    const { assets, audit, clock } = this.deps;
    return requireStore(this.deps, asset.visibility).asyncAndThen((store) =>
      assets
        .markDeleting(asset.id, asset.tenantId, clock.now())
        .andThen((marked): AppResultAsync<void, InfrastructureAppError> => {
          // Already gone (a concurrent delete finished): nothing left to do.
          if (marked === null) {
            return okAsync(undefined);
          }
          return store
            .delete(locationOf(asset))
            .mapErr((error) => {
              audit.record({
                type: 'media.cleanup_failed',
                tenantId: asset.tenantId,
                assetId: asset.id,
                errorCode: error.code,
              });
              return storageFailure(error);
            })
            .andThen(() => assets.deleteById(asset.id, asset.tenantId));
        }),
    );
  }
}
