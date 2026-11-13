import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';
import { MS_PER_SECOND } from '@lib/utils';

import { MEDIA_LIMITS, parseUploadRequest } from '../../domain/models/media-asset';
import { cacheControlFor } from '../../domain/models/media-format';
import { toMediaAssetView } from '../media-view-mappers';
import { MEDIA_RATE_LIMITS } from '../rate-limits';
import { locationOf, requireStore, storageFailure } from '../services/media-store';
import { sweepAbandonedUploads } from '../services/sweep-abandoned-uploads';
import { withinActorLimit } from '../services/within-actor-limit';

import type { MediaAsset, ValidUpload } from '../../domain/models/media-asset';
import type { MediaScope } from '../../domain/ports/media-access.port';
import type { RequestMediaUploadInput, RequestedUpload } from '../contracts/media-views';
import type { MediaDependencies, MediaOperationError } from '../media-dependencies';

/**
 * Step one of an upload: decides whether this person may put this file into this website, and
 * if so hands the browser one short-lived permission to write exactly that file.
 *
 * Order matters for partial failure. The database row exists BEFORE the permission does, so
 * every object that can ever appear in the store has a row that explains it; a permission is
 * only issued once the row is safe; and a row whose permission could not be issued is removed
 * again. Nothing about the file is trusted yet: `CompleteMediaUpload` verifies the object.
 */
export class RequestMediaUpload {
  constructor(private readonly deps: MediaDependencies) {}

  execute(input: RequestMediaUploadInput): AppResultAsync<RequestedUpload, MediaOperationError> {
    return this.deps.access
      .authorizeWebsite('media.upload', input.websiteId)
      .andThen(withinActorLimit(this.deps, MEDIA_RATE_LIMITS.requestUpload))
      .andThen((scope) =>
        parseUploadRequest(input).asyncAndThen((upload) =>
          requireStore(this.deps, upload.visibility).asyncAndThen((store) =>
            this.authorise(scope, upload, store),
          ),
        ),
      );
  }

  private authorise(
    scope: MediaScope,
    upload: ValidUpload,
    store: ObjectStore,
  ): AppResultAsync<RequestedUpload, MediaOperationError> {
    const { assets, audit, clock } = this.deps;
    const now = clock.now();
    const uploadExpiresAt = new Date(
      now.getTime() + MEDIA_LIMITS.pendingLifetimeSeconds * MS_PER_SECOND,
    );

    // Tidy first: abandoned uploads would otherwise count against the quota until they are cleared.
    return sweepAbandonedUploads(this.deps, scope.tenantId)
      .andThen(() =>
        assets.createPending(
          { ...upload, tenantId: scope.tenantId, createdBy: scope.actorId, uploadExpiresAt },
          { now, maxOpen: MEDIA_LIMITS.maxPendingPerTenant },
        ),
      )
      .andThen((asset) => this.signed(store, asset))
      .map(({ asset, target }) => {
        audit.record({
          type: 'media.upload_authorised',
          actorId: scope.actorId,
          tenantId: scope.tenantId,
          assetId: asset.id,
          visibility: asset.visibility,
          byteSize: asset.byteSize,
        });
        return {
          asset: toMediaAssetView(asset, store),
          upload: {
            method: 'PUT',
            url: target.url,
            headers: target.headers,
            expiresAt: target.expiresAt,
          },
        } satisfies RequestedUpload;
      });
  }

  /** Issues the permission; if that fails the row is withdrawn, so no reservation is left dangling. */
  private signed(store: ObjectStore, asset: MediaAsset) {
    const { assets, audit } = this.deps;
    return store
      .createUploadTarget({
        location: locationOf(asset),
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        cacheControl: cacheControlFor(asset.visibility),
        expiresInSeconds: MEDIA_LIMITS.uploadUrlSeconds,
      })
      .mapErr(storageFailure)
      .map((target) => ({ asset, target }))
      .orElse((error: InfrastructureAppError) =>
        assets
          .deleteById(asset.id, asset.tenantId)
          .orElse((cleanup) => {
            // The row stays PENDING and expires: the sweep finds it by its expiry.
            audit.record({
              type: 'media.cleanup_failed',
              tenantId: asset.tenantId,
              assetId: asset.id,
              errorCode: cleanup.code,
            });
            return okAsync(undefined);
          })
          .andThen(() => errAsync(error)),
      );
  }
}
