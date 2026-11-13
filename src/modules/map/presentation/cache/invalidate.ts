import 'server-only';

import { revalidateLocalizedPath } from '@i18n/server';

import { mapRoutes } from '../routes';

/**
 * The screens that show a map: the list (its row, the guide) and the map's own page. Addresses are
 * locale-prefixed, so they are revalidated per translation. Actions call this after a successful
 * save or deletion.
 */
export function invalidateMapScreens(websiteId: string, mapId: string): void {
  revalidateLocalizedPath(mapRoutes.list(websiteId));
  revalidateLocalizedPath(mapRoutes.edit(websiteId, mapId));
}
