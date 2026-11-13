import { combineAsync } from '@lib/result';

import { buildMapModel } from './build-map-model';

import type { Bounds } from '../../domain/geo/geometry';
import type { SavedMap } from '../../domain/models/saved-map';
import type { MapManagementDependencies } from '../map-dependencies';

/** Each layer gets a share of one total budget, including the offscreen buffer. */
export function loadMapWindow(
  deps: MapManagementDependencies,
  map: Pick<SavedMap, 'name' | 'settings' | 'websiteId'>,
  bounds: Bounds,
) {
  const layers = map.settings.layers;
  const locations = (map.settings.locations ?? []).filter(
    (location) =>
      location.longitude >= bounds[0] &&
      location.longitude <= bounds[2] &&
      location.latitude >= bounds[1] &&
      location.latitude <= bounds[3],
  );
  const limit = Math.max(
    1,
    Math.floor((map.settings.featureLimit - locations.length) / Math.max(1, layers.length)),
  );
  return combineAsync(
    layers.map((layer) =>
      deps.datasets.readWindow({
        websiteId: map.websiteId,
        layer,
        bounds,
        limit,
      }),
    ),
  ).map((batches) =>
    buildMapModel(deps, {
      layers: [
        ...(locations.length === 0
          ? []
          : [
              {
                id: 'saved-locations',
                label: map.name,
                features: locations.map(({ description, href, ...location }) => ({
                  ...location,
                  attributes: {},
                  // An empty text in the editor means "none".
                  ...(description ? { description } : {}),
                  ...(href ? { href } : {}),
                })),
              },
            ]),
        ...batches.map((batch) => batch.layer),
      ],
      config: map.settings,
      isTruncated: batches.some((batch) => batch.isTruncated),
    }),
  );
}
