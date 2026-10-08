import { describe, expect, it } from 'vitest';

import type { MapConfig } from '@modules/map';
import { MAP_VALIDATION_CODES as CODES } from '@modules/map/domain/errors/map-errors';
import type { DataIssues } from '@modules/map/domain/features/map-features';

import { districtsLayer, layer, parkingLayer, point, prepareMap } from './fixtures';

const CONFIG: MapConfig = {
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
};

describe('prepareMap: partial and invalid geographic data', () => {
  it('keeps valid features and counts what it dropped, by reason', () => {
    const model = prepareMap(
      [
        layer('mixed', [
          point('ok', 10, 51),
          { id: 'no-location', label: 'No location', attributes: {} },
          { id: 'bad-geometry', label: 'Bad', geometry: { type: 'Circle' }, attributes: {} },
          point('bad-latitude', 10, 123),
          point('ok', 11, 52),
        ]),
      ],
      CONFIG,
    );

    expect(model.featureCount).toBe(1);
    expect(model.issues).toEqual({
      received: 5,
      dropped: 4,
      byReason: {
        [CODES.geometryMissing]: 1,
        [CODES.geometryUnsupported]: 1,
        [CODES.coordinatesOutOfRange]: 1,
        [CODES.duplicateId]: 1,
      },
    });
  });

  it('draws a feature from its coordinates when its declared geometry is unusable', () => {
    const model = prepareMap(
      [layer('l', [point('a', 10, 51, {}, { geometry: { type: 'GeometryCollection' } })])],
      CONFIG,
    );
    expect(model.featureCount).toBe(1);
    expect(model.issues.dropped).toBe(0);
  });

  it('prefers a declared geometry over coordinates', () => {
    const [result] = prepareMap(
      [
        layer('l', [
          point(
            'a',
            10,
            51,
            {},
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [0, 0],
                  [1, 1],
                ],
              },
            },
          ),
        ]),
      ],
      CONFIG,
    ).layers;
    expect(result?.features[0]?.family).toBe('line');
  });

  it('reports an empty dataset as empty, not as an error', () => {
    const model = prepareMap([layer('empty', [])], CONFIG);
    expect(model.featureCount).toBe(0);
    expect(model.bounds).toBeNull();
    expect(model.issues.dropped).toBe(0);
    expect(model.filters).toEqual([]);
  });

  it('shows no map data at all when no layer is provided', () => {
    expect(prepareMap([], CONFIG).featureCount).toBe(0);
  });

  it('never lets a data attribute shadow the internal feature key', () => {
    const model = prepareMap(
      [layer('l', [point('a', 10, 51, { __key: 'spoofed', name: 'x' })])],
      CONFIG,
    );
    expect(model.layers[0]?.features[0]?.attributes).toEqual({ name: 'x' });
  });

  it('only keeps link targets that are safe to render', () => {
    const model = prepareMap(
      [
        layer('l', [
          point('a', 10, 51, {}, { href: 'javascript:alert(1)' }),
          point('b', 10, 51.1, {}, { href: '/services/parking' }),
          point('c', 10, 51.2, {}, { href: 'https://example.org/x' }),
        ]),
      ],
      CONFIG,
    );
    expect(model.layers[0]?.features.map((feature) => feature.href)).toEqual([
      undefined,
      '/services/parking',
      'https://example.org/x',
    ]);
  });
});

describe('BuildMapModel: reporting', () => {
  it('tells the reporter what was left out, and stays silent when nothing was', () => {
    const reports: DataIssues[] = [];
    prepareMap([layer('l', [point('ok', 10, 51)])], CONFIG, reports);
    expect(reports).toEqual([]);

    prepareMap(
      [layer('l', [point('ok', 10, 51), { id: 'x', label: 'x', attributes: {} }])],
      CONFIG,
      reports,
    );
    expect(reports).toEqual([
      { received: 2, dropped: 1, byReason: { [CODES.geometryMissing]: 1 } },
    ]);
  });
});

describe('prepareMap: mixed geometry types and several layers', () => {
  it('combines points, polygons and a bounding box across layers', () => {
    const model = prepareMap([parkingLayer(), districtsLayer()], CONFIG);

    expect(model.layers.map((entry) => entry.features.map((feature) => feature.family))).toEqual([
      ['point', 'point', 'point', 'point'],
      ['area'],
    ]);
    expect(model.bounds).toEqual([9.9, 50.9, 10.1, 51.1]);
  });

  it('profiles attributes without knowing their names', () => {
    const [parking] = prepareMap([parkingLayer()], CONFIG).layers;
    const byKey = Object.fromEntries(parking?.fields.map((field) => [field.key, field]) ?? []);

    expect(byKey['status']).toMatchObject({
      type: 'text',
      distinct: [
        { value: 'available', count: 2 },
        { value: 'full', count: 1 },
        { value: 'limited', count: 1 },
      ],
    });
    expect(byKey['value']).toMatchObject({ type: 'number', min: 0, max: 12 });
    expect(byKey['observedAt']).toMatchObject({ type: 'date', min: '2025-03-01T08:00:00.000Z' });
  });

  it('ignores a field whose values mix types, rather than guessing', () => {
    const [mixed] = prepareMap(
      [layer('l', [point('a', 10, 51, { reading: 1 }), point('b', 10, 51.1, { reading: 'n/a' })])],
      CONFIG,
    ).layers;
    expect(mixed?.fields.map((field) => field.key)).not.toContain('reading');
  });

  it('does not enumerate a field with too many distinct values', () => {
    const features = Array.from({ length: 80 }, (_, i) =>
      point(`p${i}`, 10, 51 + i / 1000, { name: `Name ${i}` }),
    );
    const [layerResult] = prepareMap([layer('l', features)], CONFIG).layers;
    expect(layerResult?.fields.find((field) => field.key === 'name')?.distinct).toBeNull();
  });
});
