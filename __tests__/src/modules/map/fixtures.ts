import type { Attributes, MapConfig, MapFeatureInput, MapLayerInput } from '@modules/map';
import type { MapModel } from '@modules/map/application/contracts/map-views';
import { BuildMapModel } from '@modules/map/application/queries/build-map-model';
import type { DataIssues } from '@modules/map/domain/features/map-features';

/** Runs the use case with a reporter that remembers what it was told. */
export function prepareMap(
  layers: readonly MapLayerInput[],
  config: MapConfig,
  reports: DataIssues[] = [],
): MapModel {
  const result = new BuildMapModel({
    reporter: { report: (issues) => reports.push(issues) },
  }).execute({ layers, config });
  if (result.isErr()) {
    throw new Error('BuildMapModel cannot fail');
  }
  return result.value;
}

export function point(
  id: string,
  longitude: number,
  latitude: number,
  attributes: Attributes = {},
  extra: Partial<MapFeatureInput> = {},
): MapFeatureInput {
  return { id, label: `Feature ${id}`, latitude, longitude, attributes, ...extra };
}

export function layer(
  id: string,
  features: readonly MapFeatureInput[],
  label = `Layer ${id}`,
): MapLayerInput {
  return { id, label, features };
}

/** Parking: a categorical `status`, a numeric `value` and a timestamp, none of it known to the map in advance. */
export function parkingLayer(): MapLayerInput {
  return layer('parking', [
    point('a', 10.0, 51.0, {
      status: 'available',
      value: 12,
      observedAt: '2025-03-01T08:00:00.000Z',
    }),
    point('b', 10.01, 51.01, { status: 'full', value: 0, observedAt: '2025-03-02T08:00:00.000Z' }),
    point('c', 10.02, 51.02, {
      status: 'available',
      value: 4,
      observedAt: '2025-03-03T08:00:00.000Z',
    }),
    point('d', 10.03, 51.03, {
      status: 'limited',
      value: 2,
      observedAt: '2025-03-04T08:00:00.000Z',
    }),
  ]);
}

export function districtsLayer(): MapLayerInput {
  return layer('districts', [
    {
      id: 'north',
      label: 'North district',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9.9, 50.9],
            [10.1, 50.9],
            [10.1, 51.1],
            [9.9, 51.1],
            [9.9, 50.9],
          ],
        ],
      },
      attributes: { population: 1200 },
    },
  ]);
}
