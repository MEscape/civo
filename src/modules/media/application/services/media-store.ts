import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { ObjectLocation, ObjectStore, StorageError } from '@lib/storage';

import { mediaStorageDisabled, mediaStorageFailed } from '../../domain/errors/media-errors';

import type { MediaAsset, MediaVisibility } from '../../domain/models/media-asset';
import type { MediaDependencies } from '../media-dependencies';

/** The store, if it is configured for files of this visibility. */
export function requireStore(
  deps: MediaDependencies,
  visibility: MediaVisibility,
): AppResult<ObjectStore, InfrastructureAppError> {
  const { store } = deps;
  return store.supports(visibility) ? ok(store) : err(mediaStorageDisabled());
}

/** Where an asset's bytes live. The key was derived from trusted ids when the asset was created. */
export function locationOf(asset: MediaAsset): ObjectLocation {
  return { visibility: asset.visibility, key: asset.objectKey };
}

/** A store failure as this module's failure; the store's own error stays as the cause. */
export function storageFailure(error: StorageError): InfrastructureAppError {
  return mediaStorageFailed(error);
}
