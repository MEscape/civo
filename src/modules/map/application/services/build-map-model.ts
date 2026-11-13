import { prepareLayers } from '../../domain/features/prepare-layers';
import { deriveFilters } from '../../domain/filters/filters';
import { mergeBounds } from '../../domain/geo/geometry';
import { resolveLayerStyle } from '../../domain/style/layer-style';
import { MAP_LIMITS } from '../map-limits';

import type { MapLayerInput } from '../../domain/features/map-features';
import type { Bounds } from '../../domain/geo/geometry';
import type { MapConfig } from '../../domain/models/map-config';
import type { MapModel } from '../contracts/map-views';
import type { MapDependencies } from '../map-dependencies';

export interface BuildMapModelInput {
  readonly layers: readonly MapLayerInput[];
  readonly config: MapConfig;
  readonly isTruncated?: boolean | undefined;
}

/** Bound both legacy host inputs and source windows before profiling or serializing features. */
export function buildMapModel(deps: MapDependencies, input: BuildMapModelInput): MapModel {
  let remaining: number = MAP_LIMITS.maxFeatures;
  const bounded = input.layers.slice(0, MAP_LIMITS.maxLayers).map((layer) => {
    const features = layer.features.slice(0, remaining);
    remaining -= features.length;
    return { ...layer, features };
  });
  const isTruncated =
    input.isTruncated === true ||
    bounded.length < input.layers.length ||
    bounded.some(
      (layer, index) => layer.features.length < (input.layers[index]?.features.length ?? 0),
    );
  const { layers, issues } = prepareLayers(bounded);
  if (issues.dropped > 0) {
    deps.audit.record({ type: 'map.features_dropped', ...issues });
  }
  return {
    layers,
    styles: layers.map((layer, index) => resolveLayerStyle(layer, input.config, index)),
    filters: input.config.showFilters ? deriveFilters(layers) : [],
    bounds: layers.reduce<Bounds | null>(
      (bounds, layer) => (layer.bounds === null ? bounds : mergeBounds(bounds, layer.bounds)),
      null,
    ),
    featureCount: layers.reduce((sum, layer) => sum + layer.features.length, 0),
    issues,
    isTruncated,
  };
}
