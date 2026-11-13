import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_SECOND } from '@lib/utils';

import { mediaNotPrivate, mediaNotReady } from '../../domain/errors/media-errors';
import { MEDIA_LIMITS } from '../../domain/models/media-asset';
import { MEDIA_RATE_LIMITS } from '../rate-limits';
import { findMediaAsset } from '../services/find-media-asset';
import { requireStore, storageFailure } from '../services/media-store';
import { withinActorLimit } from '../services/within-actor-limit';

import type { GetMediaReadUrlInput, MediaReadLinkView } from '../contracts/media-views';
import type { MediaDependencies, MediaOperationError } from '../media-dependencies';

/**
 * A short-lived link to one PRIVATE file, for someone who may read this website's media. The
 * link is a bearer credential: it goes to the caller and is never logged or stored. A public
 * file has no such link, since it is delivered from its public address.
 */
export class GetMediaReadUrl {
  constructor(private readonly deps: MediaDependencies) {}

  execute(input: GetMediaReadUrlInput): AppResultAsync<MediaReadLinkView, MediaOperationError> {
    const { access, assets, clock } = this.deps;

    return access
      .authorizeWebsite('media.read', input.websiteId)
      .andThen(withinActorLimit(this.deps, MEDIA_RATE_LIMITS.readUrl))
      .andThen((scope) => findMediaAsset(assets, scope, input.id))
      .andThen((asset): AppResultAsync<MediaReadLinkView, MediaOperationError> => {
        if (asset.visibility !== 'private') {
          return errAsync(mediaNotPrivate());
        }
        if (asset.status !== 'ready') {
          return errAsync(mediaNotReady());
        }

        const expiresAt = new Date(
          clock.now().getTime() + MEDIA_LIMITS.readUrlSeconds * MS_PER_SECOND,
        );
        return requireStore(this.deps, asset.visibility).asyncAndThen((store) =>
          store
            .createReadUrl({ key: asset.objectKey, expiresInSeconds: MEDIA_LIMITS.readUrlSeconds })
            .mapErr(storageFailure)
            .map((url) => ({ url, expiresAt })),
        );
      });
  }
}
