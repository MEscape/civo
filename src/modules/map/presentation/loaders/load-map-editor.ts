import type { Locale } from '@i18n';

import { orNotFound } from '@lib/errors/or-not-found';

import { loadMapUsage } from './load-map-usage';

import type { MapUsageReaders } from './load-map-usage';
import type { MapEditorReaders } from '../../application/contracts/map-reader-views';

/**
 * One map's screen: the map (or none, for a new one), the datasets it may show, and where it is
 * placed; `usedOn` is `null` for a new map or when the pages could not be read.
 */
export async function loadMapEditor({
  websiteId,
  mapId,
  queries,
  locale,
  readers,
}: {
  readonly websiteId: string;
  readonly mapId: string | undefined;
  readonly queries: MapEditorReaders;
  readonly locale: Locale;
  readonly readers: MapUsageReaders | null;
}) {
  const [map, datasets, placed] = await Promise.all([
    mapId === undefined
      ? Promise.resolve(null)
      : orNotFound(queries.getSavedMap.execute(websiteId, mapId)),
    orNotFound(queries.listMapDatasets.execute(websiteId)),
    loadMapUsage(websiteId, locale, mapId === undefined ? null : readers),
  ]);
  return {
    map,
    datasets,
    usedOn: map === null || placed.usage === null ? null : (placed.usage[map.id] ?? []),
    awaiting: placed.awaiting,
  };
}

/** Changing or withdrawing a public map needs publishing authority, so deleting it does too. */
export function mayChangeMap(
  map: { readonly settings: { readonly isPublic: boolean } } | null,
  access: { readonly canEdit: boolean; readonly canPublish: boolean },
): boolean {
  return access.canEdit && (access.canPublish || map?.settings.isPublic !== true);
}
