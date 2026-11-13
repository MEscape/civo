import { err, ok } from '@lib/result';
import { isPlainObject, trimToNull } from '@lib/utils';

import { mapInvalidInput } from '../errors/map-errors';
import { GEO_LIMITS } from '../geo/geometry';

import { EXTERNAL_MAP_ID_MAX_LENGTH } from './ids';
import { FEATURE_INTERACTIONS, MAP_HEIGHTS, POINT_STYLES } from './map-config';

import type { MapId, WebsiteId } from './ids';
import type { MapConfig, MapHeight } from './map-config';
import type { Bounds } from '../geo/geometry';

export const SAVED_MAP_LIMITS = {
  name: 120,
  description: 500,
  layers: 8,
  locations: 50,
  label: 120,
  mapsPerWebsite: 100,
  features: 500,
  maxFeatures: 1_000,
  locationDescription: 500,
  locationHref: 2_048,
} as const;

export interface SavedMapLayer {
  readonly datasetId: string;
  readonly label: string;
}

export interface SavedMapLocation {
  readonly id: string;
  readonly label: string;
  readonly longitude: number;
  readonly latitude: number;
  /** What visitors read when they select the location; an empty text means none. */
  readonly description?: string | undefined;
  /** Where selecting the location leads when the map opens links; an empty text means none. */
  readonly href?: string | undefined;
}

export interface SavedMapSettings extends MapConfig {
  readonly isPublic: boolean;
  readonly height: MapHeight;
  readonly layers: readonly SavedMapLayer[];
  readonly locations?: readonly SavedMapLocation[] | undefined;
  readonly initialBounds: Bounds;
  readonly featureLimit: number;
}

export interface SavedMapDraft {
  readonly name: string;
  readonly description: string | null;
  readonly settings: SavedMapSettings;
}

export interface SavedMap extends SavedMapDraft {
  readonly id: MapId;
  readonly websiteId: WebsiteId;
  readonly version: number;
  readonly updatedAt: Date;
}

export function isMapBounds(value: unknown): value is Bounds {
  if (
    !Array.isArray(value) ||
    value.length !== GEO_LIMITS.boundsLength ||
    !value.every(Number.isFinite)
  ) {
    return false;
  }
  const [west, south, east, north] = value as [number, number, number, number];
  return (
    west >= -GEO_LIMITS.longitude &&
    east <= GEO_LIMITS.longitude &&
    west < east &&
    south >= -GEO_LIMITS.latitude &&
    north <= GEO_LIMITS.latitude &&
    south < north
  );
}

function isSavedMapLayer(value: unknown): value is SavedMapLayer {
  if (!isPlainObject(value)) {
    return false;
  }
  const datasetId = value['datasetId'];
  const label = value['label'];
  return (
    typeof datasetId === 'string' &&
    datasetId.length > 0 &&
    datasetId.length <= EXTERNAL_MAP_ID_MAX_LENGTH &&
    typeof label === 'string' &&
    label.trim().length > 0 &&
    label.length <= SAVED_MAP_LIMITS.label
  );
}

function hasValidLayers(value: unknown): value is readonly SavedMapLayer[] {
  return (
    Array.isArray(value) &&
    value.length <= SAVED_MAP_LIMITS.layers &&
    value.every(isSavedMapLayer) &&
    new Set(value.map((layer) => layer.datasetId)).size === value.length
  );
}

function isLocationText(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= SAVED_MAP_LIMITS.label
  );
}

function isCoordinate(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maximum;
}

function isOptionalText(value: unknown, maximum: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= maximum);
}

function isSavedMapLocation(value: unknown): value is SavedMapLocation {
  return (
    isPlainObject(value) &&
    isLocationText(value['id']) &&
    isLocationText(value['label']) &&
    isOptionalText(value['description'], SAVED_MAP_LIMITS.locationDescription) &&
    isOptionalText(value['href'], SAVED_MAP_LIMITS.locationHref) &&
    isCoordinate(value['longitude'], GEO_LIMITS.longitude) &&
    isCoordinate(value['latitude'], GEO_LIMITS.latitude)
  );
}

function hasValidLocations(value: unknown): value is readonly SavedMapLocation[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= SAVED_MAP_LIMITS.locations &&
      value.every(isSavedMapLocation) &&
      new Set(value.map((location) => location.id)).size === value.length)
  );
}

function hasValidEncoding(value: Record<string, unknown>): boolean {
  return (
    POINT_STYLES.some((style) => style === value['pointStyle']) &&
    FEATURE_INTERACTIONS.some((interaction) => interaction === value['interaction']) &&
    MAP_HEIGHTS.some((height) => height === value['height']) &&
    [value['colorBy'], value['sizeBy']].every(
      (field) =>
        field === undefined ||
        (typeof field === 'string' && field.length <= SAVED_MAP_LIMITS.label),
    )
  );
}

function hasValidContent(
  layers: readonly SavedMapLayer[],
  locations: number,
  limit: unknown,
): boolean {
  return (
    layers.length + locations > 0 &&
    layers.length + (locations > 0 ? 1 : 0) <= SAVED_MAP_LIMITS.layers &&
    typeof limit === 'number' &&
    limit >= layers.length + locations
  );
}

/** Stored settings are validated too: a damaged row must never broaden a dataset request. */
export function isSavedMapSettings(value: unknown): value is SavedMapSettings {
  if (
    !isPlainObject(value) ||
    !hasValidEncoding(value) ||
    !hasValidLayers(value['layers']) ||
    !hasValidLocations(value['locations'])
  ) {
    return false;
  }
  const limit = value['featureLimit'];
  const locations = value['locations']?.length ?? 0;
  return (
    hasValidContent(value['layers'], locations, limit) &&
    ['showFilters', 'showLegend', 'isPublic'].every((field) => typeof value[field] === 'boolean') &&
    isMapBounds(value['initialBounds']) &&
    typeof limit === 'number' &&
    Number.isInteger(limit) &&
    limit <= SAVED_MAP_LIMITS.maxFeatures
  );
}

export function createSavedMapDraft(input: SavedMapDraft) {
  const name = input.name.trim();
  const description = trimToNull(input.description);
  if (
    name.length === 0 ||
    name.length > SAVED_MAP_LIMITS.name ||
    (description !== null && description.length > SAVED_MAP_LIMITS.description) ||
    !isSavedMapSettings(input.settings)
  ) {
    return err(mapInvalidInput());
  }
  return ok({ name, description, settings: input.settings });
}
