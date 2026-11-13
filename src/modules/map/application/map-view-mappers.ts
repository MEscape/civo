import type { SavedMapView } from './contracts/saved-map-views';
import type { SavedMap } from '../domain/models/saved-map';

export function toSavedMapView(map: SavedMap): SavedMapView {
  return { ...map, updatedAt: map.updatedAt.toISOString() };
}
