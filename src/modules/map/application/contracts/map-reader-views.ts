import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { Bounds } from './map-constraints';
import type { MapModel } from './map-views';
import type { SavedMapDraft, SavedMapView } from './saved-map-views';

export interface MapDatasetChoices {
  readonly items: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly isTruncated: boolean;
}

/** Presentation depends on query capabilities, never composition or persistence implementations. */
export interface MapEditorReaders {
  readonly getSavedMap: {
    execute(websiteId: string, mapId: string): AppResultAsync<SavedMapView>;
  };
  readonly listMapDatasets: {
    execute(websiteId: string): AppResultAsync<MapDatasetChoices>;
  };
}

export interface MapListReaders {
  readonly listSavedMaps: {
    execute(websiteId: string, page: PageRequest): AppResultAsync<Page<SavedMapView>>;
  };
}

export interface InlineMapReaders {
  readonly issueInlineMapToken: {
    execute(input: {
      readonly websiteId: string;
      readonly mode: 'draft' | 'published';
      readonly draft: SavedMapDraft;
    }): AppResultAsync<string>;
  };
  readonly readInlineMapWindow: {
    execute(input: { readonly token: string; readonly bounds: Bounds }): AppResultAsync<MapModel>;
  };
}

export interface SavedMapReaders {
  readonly getSavedMap: MapEditorReaders['getSavedMap'];
  readonly previewMapWindow: {
    execute(input: {
      readonly websiteId: string;
      readonly draft: SavedMapDraft;
      readonly bounds: Bounds;
    }): AppResultAsync<MapModel>;
  };
}
