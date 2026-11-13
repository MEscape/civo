import type { SavedMapReaders } from '../../application/contracts/map-reader-views';

/** The draft a saved map shows in the editor and its first window; `null` when either is unavailable. */
export async function loadSavedMap(queries: SavedMapReaders, websiteId: string, mapId: string) {
  const map = await queries.getSavedMap.execute(websiteId, mapId);
  if (map.isErr()) {
    return null;
  }
  const window = await queries.previewMapWindow.execute({
    websiteId,
    bounds: map.value.settings.initialBounds,
    draft: map.value,
  });
  return window.isErr() ? null : { map: map.value, model: window.value };
}
