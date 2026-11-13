import type { SavedMapDraft, SavedMapSettings } from '../../domain/models/saved-map';

export type { SavedMapDraft, SavedMapSettings, SavedMapLayer } from '../../domain/models/saved-map';
export { SAVED_MAP_LIMITS } from '../../domain/models/saved-map';

export interface SavedMapView extends SavedMapDraft {
  readonly id: string;
  readonly websiteId: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly settings: SavedMapSettings;
}

/** A map as a release stored it: JSON the map module wrote and a release only kept. */
export interface StoredPublishedMap {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly settings: unknown;
}

export interface SaveMapInput extends SavedMapDraft {
  readonly websiteId: string;
  readonly id?: string | undefined;
  readonly version?: number | undefined;
}
