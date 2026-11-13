import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mediaNotFound } from '../../domain/errors/media-errors';
import { parseMediaAssetId } from '../../domain/models/ids';

import type { MediaAsset } from '../../domain/models/media-asset';
import type { MediaScope } from '../../domain/ports/media-access.port';
import type { MediaAssetRepository } from '../../domain/ports/media-asset.repository';

/**
 * Loads one file of the authorized website. Another website's id is simply "not found", and a
 * record from another tenant is refused even if a repository ever returned one.
 */
export function findMediaAsset(
  assets: MediaAssetRepository,
  scope: MediaScope,
  rawId: string,
): AppResultAsync<MediaAsset, ValidationAppError | NotFoundAppError | InfrastructureAppError> {
  return parseMediaAssetId(rawId)
    .asyncAndThen((id) => assets.findById(id, scope.tenantId))
    .andThen((asset) =>
      asset?.tenantId === scope.tenantId ? okAsync(asset) : errAsync(mediaNotFound()),
    );
}
