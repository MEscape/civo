import type { ObjectStore } from '@lib/storage';

import { parseMediaAssetId } from '../../domain/models/ids';
import { mediaObjectKey } from '../../domain/models/media-asset';

/**
 * Where visitors load a file from, worked out from the website and the file's id alone: no
 * database read, no request, so rendering a page costs nothing extra per image.
 *
 *  - The website is the one the SERVER is rendering, never a value from the page's own props, so
 *    a page can only ever name its own website's files: another website's id maps to a key
 *    under this website that does not exist.
 *  - Only the public bucket has an address. A private file's id maps to nothing there (it
 *    lives in another bucket), so it shows as a missing image and never leaks.
 *  - `null` while no public origin is set, or for a value that is not a file id.
 */
export function resolvePublicMediaUrl(
  store: ObjectStore,
  websiteId: string,
  assetId: string,
): string | null {
  const id = parseMediaAssetId(assetId);
  return id.isErr() ? null : store.publicUrl(mediaObjectKey(websiteId, id.value));
}
