import type { Result } from '@lib/result';
import { isRelativePath, isValidUrl } from '@lib/utils';

import { MAP_VALIDATION_CODES } from '../errors/map-errors';
import {
  geometryBounds,
  geometryFamily,
  mergeBounds,
  parseGeometry,
  pointFromCoordinates,
} from '../geo/geometry';

import { profileFields } from './profile-fields';

import type {
  Attributes,
  DataIssues,
  FeatureIssue,
  MapFeature,
  MapFeatureInput,
  MapLayer,
  MapLayerInput,
} from './map-features';
import type { Bounds, GeoGeometry, GeometryIssue } from '../geo/geometry';

/** Internal GeoJSON property that carries the feature key; attributes may not use it. */
const RESERVED_ATTRIBUTE_PREFIX = '__';

export interface PreparedLayers {
  readonly layers: readonly MapLayer[];
  readonly issues: DataIssues;
}

/** A link target is shown as a real link, so only http(s) and same-origin paths qualify. */
export function isSafeHref(href: string): boolean {
  return isValidUrl(href) || isRelativePath(href);
}

function resolveGeometry(input: MapFeatureInput): Result<GeoGeometry, GeometryIssue> {
  const declared = input.geometry === undefined ? undefined : parseGeometry(input.geometry);
  if (declared?.isOk() === true) {
    return declared;
  }
  // An unusable geometry does not cost a feature that also carries valid coordinates.
  const fallback = pointFromCoordinates(input.latitude, input.longitude);
  return fallback.isOk() || declared === undefined ? fallback : declared;
}

function cleanAttributes(attributes: Attributes): Attributes {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!key.startsWith(RESERVED_ATTRIBUTE_PREFIX)) {
      clean[key] = value;
    }
  }
  return clean;
}

function toFeature(layerId: string, input: MapFeatureInput, geometry: GeoGeometry): MapFeature {
  return {
    key: `${layerId}:${input.id}`,
    label: input.label,
    geometry,
    family: geometryFamily(geometry),
    attributes: cleanAttributes(input.attributes),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.href !== undefined && isSafeHref(input.href) ? { href: input.href } : {}),
  };
}

function prepareLayer(input: MapLayerInput, dropped: Map<FeatureIssue, number>): MapLayer {
  const features: MapFeature[] = [];
  const seen = new Set<string>();
  let bounds: Bounds | null = null;

  const drop = (reason: FeatureIssue) => {
    dropped.set(reason, (dropped.get(reason) ?? 0) + 1);
  };

  for (const candidate of input.features) {
    const geometry = resolveGeometry(candidate);
    if (geometry.isErr()) {
      drop(geometry.error);
    } else if (seen.has(candidate.id)) {
      // Two records with one id would make selection ambiguous; the first one wins.
      drop(MAP_VALIDATION_CODES.duplicateId);
    } else {
      seen.add(candidate.id);
      bounds = mergeBounds(bounds, geometryBounds(geometry.value));
      features.push(toFeature(input.id, candidate, geometry.value));
    }
  }

  return {
    id: input.id,
    label: input.label,
    features,
    fields: profileFields(features),
    bounds,
  };
}

/**
 * Validates external features and profiles their attributes. Invalid
 * features are dropped one by one and counted by reason: a single malformed
 * record never breaks the map, and the loss is visible to the caller.
 */
export function prepareLayers(inputs: readonly MapLayerInput[]): PreparedLayers {
  const dropped = new Map<FeatureIssue, number>();
  const layers = inputs.map((input) => prepareLayer(input, dropped));

  const received = inputs.reduce((sum, layer) => sum + layer.features.length, 0);
  const droppedCount = [...dropped.values()].reduce((sum, count) => sum + count, 0);

  return {
    layers,
    issues: { received, dropped: droppedCount, byReason: Object.fromEntries(dropped) },
  };
}
