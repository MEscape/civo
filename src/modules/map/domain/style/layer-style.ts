import type { FieldProfile, MapLayer } from '../features/map-features';
import type { GeometryFamily } from '../geo/geometry';
import type { MapConfig, PointStyle } from '../models/map-config';

/** Categorical colours available; matches the design system's series palette. */
export const PALETTE_SIZE = 6;

/** Attributes tried, in order, when the configuration does not name one. */
const AUTO_CATEGORY_FIELDS = ['status', 'category'] as const;
const AUTO_SIZE_FIELD = 'value';
const MIN_CATEGORIES = 2;

export interface CategoryEntry {
  readonly value: string;
  /** Index into the series palette. */
  readonly slot: number;
  readonly count: number;
}

/**
 * Colour is data-driven by one of three encodings. The same object feeds
 * both the Mapbox translation and the legend, so the two cannot disagree.
 */
export type ColorEncoding =
  | { readonly kind: 'fixed'; readonly slot: number }
  | {
      readonly kind: 'categories';
      readonly field: string;
      readonly entries: readonly CategoryEntry[];
      /** Values beyond the palette share one neutral colour. */
      readonly otherCount: number;
    }
  | { readonly kind: 'range'; readonly field: string; readonly min: number; readonly max: number };

export type SizeEncoding =
  | { readonly kind: 'fixed' }
  | { readonly kind: 'range'; readonly field: string; readonly min: number; readonly max: number };

export interface LayerStyle {
  readonly layerId: string;
  readonly label: string;
  readonly pointStyle: PointStyle;
  readonly color: ColorEncoding;
  readonly size: SizeEncoding;
  /** Which kinds of geometry the layer contains, for the legend's symbols. */
  readonly families: readonly GeometryFamily[];
}

function profileOf(layer: MapLayer, key: string | undefined): FieldProfile | undefined {
  return key === undefined || key === ''
    ? undefined
    : layer.fields.find((field) => field.key === key);
}

function categoriesOf(profile: FieldProfile): ColorEncoding | null {
  const distinct = profile.distinct;
  if (distinct === null || distinct.length < MIN_CATEGORIES) {
    return null;
  }
  const overflow = distinct.length > PALETTE_SIZE;
  // With more values than colours, the last colour becomes the shared "other".
  const named = overflow ? distinct.slice(0, PALETTE_SIZE - 1) : distinct;
  const otherCount = distinct.slice(named.length).reduce((sum, entry) => sum + entry.count, 0);
  return {
    kind: 'categories',
    field: profile.key,
    entries: named.map((entry, slot) => ({ value: entry.value, slot, count: entry.count })),
    otherCount,
  };
}

function rangeOf(profile: FieldProfile): { min: number; max: number } | null {
  if (
    profile.type !== 'number' ||
    typeof profile.min !== 'number' ||
    typeof profile.max !== 'number'
  ) {
    return null;
  }
  return profile.min < profile.max ? { min: profile.min, max: profile.max } : null;
}

function encodeColor(layer: MapLayer, config: MapConfig, layerIndex: number): ColorEncoding {
  const explicit = profileOf(layer, config.colorBy);
  if (explicit !== undefined) {
    const range = rangeOf(explicit);
    if (range !== null) {
      return { kind: 'range', field: explicit.key, ...range };
    }
    const categories = categoriesOf(explicit);
    if (categories !== null) {
      return categories;
    }
  }
  // Not configured, or the field does not fit this layer: fall back to what the layer itself offers.
  for (const key of AUTO_CATEGORY_FIELDS) {
    const profile = profileOf(layer, key);
    const categories = profile === undefined ? null : categoriesOf(profile);
    if (categories !== null) {
      return categories;
    }
  }
  return { kind: 'fixed', slot: layerIndex % PALETTE_SIZE };
}

function encodeSize(layer: MapLayer, config: MapConfig): SizeEncoding {
  if (config.pointStyle !== 'circles' && config.pointStyle !== 'heatmap') {
    return { kind: 'fixed' };
  }
  for (const key of [config.sizeBy, AUTO_SIZE_FIELD]) {
    const profile = profileOf(layer, key);
    const range = profile === undefined ? null : rangeOf(profile);
    if (profile !== undefined && range !== null) {
      return { kind: 'range', field: profile.key, ...range };
    }
  }
  return { kind: 'fixed' };
}

/**
 * Decides how one layer looks, from its data and the configuration. A field
 * the configuration names but the layer does not have is not an error: that
 * layer picks its own, which is what lets one map mix datasets from
 * different sources.
 */
export function resolveLayerStyle(
  layer: MapLayer,
  config: MapConfig,
  layerIndex: number,
): LayerStyle {
  const families = [...new Set(layer.features.map((feature) => feature.family))];
  return {
    layerId: layer.id,
    label: layer.label,
    pointStyle: config.pointStyle,
    color: encodeColor(layer, config, layerIndex),
    size: encodeSize(layer, config),
    families,
  };
}
