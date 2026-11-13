import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mediaNotFound } from '../../domain/errors/media-errors';
import { toMediaAssetView } from '../media-view-mappers';
import { MEDIA_RATE_LIMITS } from '../rate-limits';
import { findMediaAsset } from '../services/find-media-asset';
import { markUploadReady } from '../services/mark-upload-ready';
import { verifyUpload } from '../services/verify-upload';
import { withinActorLimit } from '../services/within-actor-limit';

import type { CompleteMediaUploadInput, MediaAssetView } from '../contracts/media-views';
import type { MediaDependencies, MediaOperationError } from '../media-dependencies';

/**
 * Step two of an upload: the browser says it has finished, and the server checks it. The client's
 * word is never enough: the stored object must be what was announced (`verifyUpload`), and only
 * then does the asset become READY (`markUploadReady`).
 *
 *  - Called twice, or by two tabs at once: the conditional write lets exactly one win, the
 *    others see a READY asset and succeed.
 *  - The database fails after the object is verified: nothing is lost, calling again repeats it.
 *
 * @audit-exempt The services it calls record the outcome: `verifyUpload` a rejected upload (`media.upload_rejected`) and `markUploadReady` a completed one (`media.upload_completed`); a repeated call changes nothing.
 */
export class CompleteMediaUpload {
  constructor(private readonly deps: MediaDependencies) {}

  execute(input: CompleteMediaUploadInput): AppResultAsync<MediaAssetView, MediaOperationError> {
    const { access, assets, store } = this.deps;

    return access
      .authorizeWebsite('media.upload', input.websiteId)
      .andThen(withinActorLimit(this.deps, MEDIA_RATE_LIMITS.completeUpload))
      .andThen((scope) =>
        findMediaAsset(assets, scope, input.id).andThen((asset) => {
          // A file on its way out is gone as far as anyone is concerned.
          if (asset.status === 'deleting') {
            return errAsync(mediaNotFound());
          }
          if (asset.status === 'ready') {
            return okAsync(asset);
          }
          return verifyUpload(this.deps, scope, asset).andThen(() =>
            markUploadReady(this.deps, scope, asset),
          );
        }),
      )
      .map((ready) => toMediaAssetView(ready, store));
  }
}
