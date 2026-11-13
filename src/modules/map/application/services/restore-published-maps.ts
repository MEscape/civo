import { isSavedMapSettings } from '../../domain/models/saved-map';

import type { SavedMapDraft, StoredPublishedMap } from '../contracts/saved-map-views';

/**
 * The frozen maps of a release, by id, ready to draw. Stored JSON is external data: a map whose
 * settings no longer pass the map's own check, or that is not public, is left out, so the page
 * that places it shows the map as unavailable rather than a broadened or private one.
 */
export function restorePublishedMaps(
  stored: readonly StoredPublishedMap[],
): Readonly<Record<string, SavedMapDraft>> {
  const restored: Record<string, SavedMapDraft> = {};
  for (const map of stored) {
    if (isSavedMapSettings(map.settings) && map.settings.isPublic) {
      restored[map.id] = { name: map.name, description: map.description, settings: map.settings };
    }
  }
  return restored;
}
