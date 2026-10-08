import { ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { prepareLayers } from '../../domain/features/prepare-layers';
import { deriveFilters } from '../../domain/filters/filters';
import { mergeBounds } from '../../domain/geo/geometry';
import { resolveLayerStyle } from '../../domain/style/layer-style';

import type { MapLayerInput } from '../../domain/features/map-features';
import type { Bounds } from '../../domain/geo/geometry';
import type { MapConfig } from '../../domain/models/map-config';
import type { MapModel } from '../contracts/map-views';
import type { MapDependencies } from '../map-dependencies';

export interface BuildMapModelInput {
  /** One entry per dataset. Untrusted: validated here, feature by feature. */
  readonly layers: readonly MapLayerInput[];
  readonly config: MapConfig;
}

/**
 * Turns the layers a host provides into a map model: validates external
 * features, decides the visual encoding, derives the filters. Invalid
 * features are dropped one by one and reported, never fatal, so this cannot
 * fail; a layer with nothing drawable is kept and contributes no bounds.
 *
 * @authorization public The map renders data its host already loaded and authorized; this use case reads no resource.
 */
export class BuildMapModel {
  constructor(private readonly deps: MapDependencies) {}

  execute(input: BuildMapModelInput): AppResult<MapModel, never> {
    const { layers, issues } = prepareLayers(input.layers);

    if (issues.dropped > 0) {
      this.deps.reporter.report(issues);
    }

    return ok({
      layers,
      styles: layers.map((layer, index) => resolveLayerStyle(layer, input.config, index)),
      filters: input.config.showFilters ? deriveFilters(layers) : [],
      bounds: layers.reduce<Bounds | null>(
        (bounds, layer) => (layer.bounds === null ? bounds : mergeBounds(bounds, layer.bounds)),
        null,
      ),
      featureCount: layers.reduce((sum, layer) => sum + layer.features.length, 0),
      issues,
    });
  }
}
