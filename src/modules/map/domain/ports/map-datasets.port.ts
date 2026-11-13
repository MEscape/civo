import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { MapLayerInput } from '../features/map-features';
import type { Bounds } from '../geo/geometry';
import type { DatasetId, WebsiteId } from '../models/ids';
import type { SavedMapLayer } from '../models/saved-map';

export interface MapDatasetWindow {
  readonly websiteId: WebsiteId;
  readonly layer: SavedMapLayer;
  /** Apply spatial selection before offset and limit, never to an already paged batch. */
  readonly bounds: Bounds;
  readonly limit: number;
}

export interface MapDatasetBatch {
  readonly layer: MapLayerInput;
  readonly isTruncated: boolean;
}

/** The data sources module's refusals pass through: access, lookup, limits and storage alike. */
export type MapDatasetError = AppError;

export interface MapDatasets {
  listChoices(websiteId: WebsiteId): AppResultAsync<{
    readonly items: ReadonlyArray<{ readonly id: DatasetId; readonly name: string }>;
    readonly isTruncated: boolean;
  }>;
  readWindow(request: MapDatasetWindow): AppResultAsync<MapDatasetBatch>;
  /** Saving must independently check ownership of every selected dataset. */
  validateLayers(websiteId: WebsiteId, layers: readonly SavedMapLayer[]): AppResultAsync<void>;
}
