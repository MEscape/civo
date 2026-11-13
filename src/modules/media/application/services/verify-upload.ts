import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { ObjectStore, StoredObject } from '@lib/storage';

import { mediaUploadMissing, mediaUploadRejected } from '../../domain/errors/media-errors';
import { SNIFF_BYTES, sniffMediaFormat } from '../../domain/models/media-format';

import { locationOf, requireStore, storageFailure } from './media-store';

import type { MediaAsset } from '../../domain/models/media-asset';
import type { MediaScope } from '../../domain/ports/media-access.port';
import type { MediaEvent } from '../../domain/ports/media-audit-log.port';
import type { MediaDependencies } from '../media-dependencies';

/** Who is finishing which upload, into which store. */
interface Subject {
  readonly scope: MediaScope;
  readonly asset: MediaAsset;
  readonly store: ObjectStore;
}

type VerifyError = ConflictAppError | ValidationAppError | InfrastructureAppError;

type Rejection = Extract<MediaEvent, { type: 'media.upload_rejected' }>['reason'];

/**
 * Checks the stored object against what was announced: it must exist, have exactly the announced
 * size and type, and start with the signature of that type. The client's word is never enough.
 *
 *  - Not uploaded yet: a conflict, the row stays PENDING and the client may upload and call again.
 *  - Not what was announced: the object and the row are removed, the client must start over.
 */
export function verifyUpload(
  deps: MediaDependencies,
  scope: MediaScope,
  asset: MediaAsset,
): AppResultAsync<null, VerifyError> {
  return requireStore(deps, asset.visibility).asyncAndThen((store) =>
    store
      .head(locationOf(asset))
      .mapErr(storageFailure)
      .andThen((stored) =>
        stored === null
          ? errAsync<null, VerifyError>(mediaUploadMissing())
          : inspect(deps, { scope, asset, store }, stored),
      ),
  );
}

function inspect(
  deps: MediaDependencies,
  subject: Subject,
  stored: StoredObject,
): AppResultAsync<null, VerifyError> {
  const { asset, store } = subject;
  if (stored.byteSize !== asset.byteSize) {
    return reject(deps, subject, 'size');
  }
  if (stored.contentType?.toLowerCase() !== asset.contentType) {
    return reject(deps, subject, 'content_type');
  }
  return store
    .readStart(locationOf(asset), SNIFF_BYTES)
    .mapErr((error): VerifyError =>
      error.kind === 'not_found' ? mediaUploadMissing() : storageFailure(error),
    )
    .andThen((bytes) =>
      sniffMediaFormat(bytes) === asset.contentType
        ? okAsync<null, VerifyError>(null)
        : reject(deps, subject, 'signature'),
    );
}

function reject(
  deps: MediaDependencies,
  subject: Subject,
  reason: Rejection,
): AppResultAsync<null, VerifyError> {
  const { scope, asset, store } = subject;
  const { assets, audit } = deps;
  audit.record({
    type: 'media.upload_rejected',
    actorId: scope.actorId,
    tenantId: asset.tenantId,
    assetId: asset.id,
    reason,
  });
  // Object first, then row: if the object cannot be removed the row stays PENDING and expires,
  // so the leftover stays findable. Failures here must not hide the rejection from the client.
  return store
    .delete(locationOf(asset))
    .mapErr(storageFailure)
    .andThen(() => assets.deleteById(asset.id, asset.tenantId))
    .orElse((cleanup: InfrastructureAppError) => {
      audit.record({
        type: 'media.cleanup_failed',
        tenantId: asset.tenantId,
        assetId: asset.id,
        errorCode: cleanup.code,
      });
      return okAsync(undefined);
    })
    .andThen(() => errAsync<null, VerifyError>(mediaUploadRejected()));
}
