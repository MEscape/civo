import { describe, expect, it } from 'vitest';

import type { MapConfig } from '@modules/map';
import {
  countActiveFilters,
  deriveFilters,
  filterFeatures,
} from '@modules/map/domain/filters/filters';

import { districtsLayer, layer, parkingLayer, point, prepareMap } from './fixtures';

const CONFIG: MapConfig = {
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
};

function layersOf(...inputs: Parameters<typeof prepareMap>[0]) {
  return prepareMap(inputs, CONFIG).layers;
}

describe('deriveFilters', () => {
  it('derives select, range and date filters from what the data contains', () => {
    const filters = deriveFilters(layersOf(parkingLayer()));

    expect(filters.map((filter) => [filter.field, filter.kind])).toEqual([
      ['status', 'select'],
      ['observedAt', 'dateRange'],
      ['value', 'range'],
    ]);
    expect(filters.find((filter) => filter.kind === 'dateRange')).toMatchObject({
      min: '2025-03-01',
      max: '2025-03-04',
    });
  });

  it('offers nothing for a dataset that only has locations', () => {
    expect(deriveFilters(layersOf(layer('l', [point('a', 10, 51), point('b', 10, 52)])))).toEqual(
      [],
    );
  });

  it('skips fields that do not vary or have too many values to pick from', () => {
    const features = Array.from({ length: 20 }, (_, i) =>
      point(`p${i}`, 10, 51 + i / 100, { species: `Species ${i}`, kind: 'tree', height: 5 }),
    );
    expect(deriveFilters(layersOf(layer('trees', features)))).toEqual([]);
  });

  it('works for a municipality with entirely different fields', () => {
    const filters = deriveFilters(
      layersOf(
        layer('trees', [
          point('a', 10, 51, { species: 'Oak', condition: 'good' }),
          point('b', 10, 51.1, { species: 'Beech', condition: 'good' }),
          point('c', 10, 51.2, { species: 'Oak', condition: 'poor' }),
        ]),
      ),
    );
    expect(filters.map((filter) => filter.field).sort()).toEqual(['condition', 'species']);
  });

  it('merges a field shared by several layers and drops one the layers disagree about', () => {
    const merged = deriveFilters(
      layersOf(
        layer('a', [
          point('1', 10, 51, { status: 'open', level: 1 }),
          point('2', 10, 52, { status: 'closed', level: 5 }),
        ]),
        layer('b', [
          point('3', 11, 51, { status: 'open', level: 'high' }),
          point('4', 11, 52, { status: 'planned', level: 'low' }),
        ]),
      ),
    );
    const status = merged.find((filter) => filter.field === 'status');
    expect(status).toMatchObject({
      kind: 'select',
      options: [
        { value: 'open', count: 2 },
        { value: 'closed', count: 1 },
        { value: 'planned', count: 1 },
      ],
    });
    expect(merged.some((filter) => filter.field === 'level')).toBe(false);
  });

  it('caps how many filters are shown', () => {
    const attributes = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, key]));
    const features = [
      point('1', 10, 51, attributes),
      point(
        '2',
        10,
        52,
        Object.fromEntries(Object.keys(attributes).map((key) => [key, `${key}2`])),
      ),
    ];
    expect(deriveFilters(layersOf(layer('l', features))).length).toBeLessThanOrEqual(4);
  });
});

describe('filterFeatures', () => {
  const [parking] = layersOf(parkingLayer());

  it('returns every feature when nothing is active', () => {
    expect(filterFeatures(parking!, {})).toHaveLength(4);
    expect(filterFeatures(parking!, { status: { kind: 'select', selected: [] } })).toHaveLength(4);
  });

  it('filters by one or several categories', () => {
    expect(
      filterFeatures(parking!, { status: { kind: 'select', selected: ['available'] } }).map(
        (f) => f.key,
      ),
    ).toEqual(['parking:a', 'parking:c']);
    expect(
      filterFeatures(parking!, { status: { kind: 'select', selected: ['full', 'limited'] } }),
    ).toHaveLength(2);
  });

  it('filters by an inclusive numeric range, open at either end', () => {
    expect(filterFeatures(parking!, { value: { kind: 'range', min: 2, max: 12 } })).toHaveLength(3);
    expect(filterFeatures(parking!, { value: { kind: 'range', min: 5, max: null } })).toHaveLength(
      1,
    );
    expect(filterFeatures(parking!, { value: { kind: 'range', min: null, max: 0 } })).toHaveLength(
      1,
    );
  });

  it('filters by a date range on the day, whatever the time', () => {
    const inRange = filterFeatures(parking!, {
      observedAt: { kind: 'dateRange', from: '2025-03-02', to: '2025-03-03' },
    });
    expect(inRange.map((f) => f.key)).toEqual(['parking:b', 'parking:c']);
  });

  it('combines filters with AND', () => {
    const result = filterFeatures(parking!, {
      status: { kind: 'select', selected: ['available'] },
      value: { kind: 'range', min: 10, max: null },
    });
    expect(result.map((f) => f.key)).toEqual(['parking:a']);
  });

  it('does not make a layer disappear that lacks the filtered field', () => {
    const [, districts] = layersOf(parkingLayer(), districtsLayer());
    expect(
      filterFeatures(districts!, { status: { kind: 'select', selected: ['available'] } }),
    ).toHaveLength(1);
  });

  it('hides features that have no value for an active filter', () => {
    const [sparse] = layersOf(
      layer('s', [
        point('a', 10, 51, { grade: 'A' }),
        point('b', 10, 52, {}),
        point('c', 10, 53, { grade: 'B' }),
      ]),
    );
    expect(
      filterFeatures(sparse!, { grade: { kind: 'select', selected: ['A'] } }).map((f) => f.key),
    ).toEqual(['s:a']);
  });

  it('counts only active filters', () => {
    expect(
      countActiveFilters({
        status: { kind: 'select', selected: ['a'] },
        value: { kind: 'range', min: null, max: null },
      }),
    ).toBe(1);
  });
});
