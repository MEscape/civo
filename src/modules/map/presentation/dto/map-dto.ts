import type { Page } from '@lib/pagination';

import type { MapModel } from '../../application/contracts/map-views';
import type { SavedMapSettings, SavedMapView } from '../../application/contracts/saved-map-views';

/** Every field is already a JSON value; no domain timestamps, brands or credentials cross this boundary. */
export interface SavedMapDto {
  readonly id: string;
  readonly websiteId: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly name: string;
  readonly description: string | null;
  readonly settings: SavedMapSettings;
}

export interface MapWindowDto {
  readonly layers: MapModel['layers'];
  readonly styles: MapModel['styles'];
  readonly filters: MapModel['filters'];
  readonly bounds: MapModel['bounds'];
  readonly featureCount: number;
  readonly issues: MapModel['issues'];
  readonly isTruncated?: boolean | undefined;
}

export interface MapOptionsDto {
  readonly items: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly isTruncated: boolean;
}

export function toSavedMapDto(view: SavedMapView): SavedMapDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    version: view.version,
    updatedAt: view.updatedAt,
    name: view.name,
    description: view.description,
    settings: view.settings,
  };
}

export function toMapWindowDto(view: MapModel): MapWindowDto {
  return {
    layers: view.layers,
    styles: view.styles,
    filters: view.filters,
    bounds: view.bounds,
    featureCount: view.featureCount,
    issues: view.issues,
    isTruncated: view.isTruncated,
  };
}

export function toMapOptionsDto(page: Page<SavedMapView>): MapOptionsDto {
  return {
    items: page.items.map(({ id, name }) => ({ id, name })),
    isTruncated: page.items.length < page.total,
  };
}
