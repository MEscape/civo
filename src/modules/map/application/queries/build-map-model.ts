import { ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { buildMapModel } from '../services/build-map-model';

import type { MapLayerInput } from '../../domain/features/map-features';
import type { MapConfig } from '../../domain/models/map-config';
import type { MapModel } from '../contracts/map-views';
import type { MapDependencies } from '../map-dependencies';

export interface BuildMapModelInput {
  /** One entry per dataset. Untrusted: validated here, feature by feature. */
  readonly layers: readonly MapLayerInput[];
  readonly config: MapConfig;
  readonly isTruncated?: boolean | undefined;
}

/**
 * Turns the layers a host provides into a map model: validates external
 * features, decides the visual encoding, derives the filters. Invalid
 * features are dropped one by one and reported, never fatal, so this cannot
 * fail; a layer with nothing drawable is kept and contributes no bounds.
 *
 * @authorization public The map renders data its host already loaded and authorized; this use case reads no resource.
 * @rate-limit none Reads nothing: it turns data its host already loaded into a model.
 */
export class BuildMapModel {
  constructor(private readonly deps: MapDependencies) {}

  execute(input: BuildMapModelInput): AppResult<MapModel, never> {
    return ok(buildMapModel(this.deps, input));
  }
}
