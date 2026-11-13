import type { ObjectStore } from '@lib/storage';

import type { MediaAssetView } from './contracts/media-views';
import type { MediaAsset } from '../domain/models/media-asset';

export function toMediaAssetView(asset: MediaAsset, store: ObjectStore): MediaAssetView {
  return {
    id: asset.id,
    originalFilename: asset.originalFilename,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    visibility: asset.visibility,
    status: asset.status,
    createdAt: asset.createdAt,
    publicUrl:
      asset.visibility === 'public' && asset.status === 'ready'
        ? store.publicUrl(asset.objectKey)
        : null,
  };
}
