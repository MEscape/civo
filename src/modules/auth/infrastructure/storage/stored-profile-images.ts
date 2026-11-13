import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';

import { providerFailed } from '../../domain/errors/auth-errors';

import type { ActorId } from '../../domain/models/ids';
import type { ProfileImage } from '../../domain/models/profile';
import type { ProfileImages } from '../../domain/ports/profile-images.port';

const UPLOAD_LIFETIME_SECONDS = 60;
const UPLOAD_TIMEOUT_MS = 10_000;

/** Uploads server-validated image bytes for an existing account; no upload capability reaches the browser. */
export class StoredProfileImages implements ProfileImages {
  constructor(
    private readonly deps: {
      readonly getStore: () => ObjectStore;
      readonly newId: () => string;
    },
  ) {}

  upload(actorId: ActorId, image: ProfileImage): AppResultAsync<string, InfrastructureAppError> {
    const store = this.deps.getStore();
    const key = `${this.prefix(actorId)}/${this.deps.newId()}`;
    const url = store.publicUrl(key);
    if (url === null) {
      return errAsync(providerFailed(undefined));
    }
    return store
      .createUploadTarget({
        location: { visibility: 'public', key },
        contentType: image.contentType,
        byteSize: image.bytes.byteLength,
        cacheControl: 'public, max-age=31536000, immutable',
        expiresInSeconds: UPLOAD_LIFETIME_SECONDS,
      })
      .mapErr(providerFailed)
      .andThen((target) =>
        fromThrowableAsync(
          async () => {
            const response = await fetch(target.url, {
              method: 'PUT',
              headers: target.headers,
              body: new Uint8Array(image.bytes),
              signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            });
            return response.ok;
          },
          (cause) => {
            logger.error('auth.profile_image_upload_failed', { code: 'auth.provider_failed' });
            return providerFailed(cause);
          },
        ).andThen((isUploaded) =>
          isUploaded ? okAsync(url) : errAsync(providerFailed(undefined)),
        ),
      );
  }

  remove(actorId: ActorId, url: string): AppResultAsync<void, InfrastructureAppError> {
    const store = this.deps.getStore();
    const prefix = this.prefix(actorId);
    const baseUrl = store.publicUrl(prefix);
    if (baseUrl === null || !url.startsWith(`${baseUrl}/`)) {
      return okAsync(undefined);
    }
    const suffix = url.slice(baseUrl.length + 1);
    if (!/^[a-f0-9-]+$/.test(suffix)) {
      return okAsync(undefined);
    }
    return store.delete({ visibility: 'public', key: `${prefix}/${suffix}` }).mapErr((cause) => {
      logger.warn('auth.profile_image_cleanup_failed');
      return providerFailed(cause);
    });
  }

  private prefix(actorId: ActorId): string {
    return `profiles/${actorId}`;
  }
}
