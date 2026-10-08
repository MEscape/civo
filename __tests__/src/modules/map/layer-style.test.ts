import { describe, expect, it } from 'vitest';

import type { MapConfig } from '@modules/map';
import { PALETTE_SIZE } from '@modules/map/domain/style/layer-style';

import { districtsLayer, layer, parkingLayer, point, prepareMap } from './fixtures';

const BASE: MapConfig = {
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
};

const styleOf = (config: Partial<MapConfig>, ...inputs: Parameters<typeof prepareMap>[0]) =>
  prepareMap(inputs, { ...BASE, ...config }).styles;

describe('layer styles are driven by the data', () => {
  it('colours by status automatically, most frequent value first', () => {
    const [style] = styleOf({}, parkingLayer());
    expect(style?.color).toEqual({
      kind: 'categories',
      field: 'status',
      entries: [
        { value: 'available', slot: 0, count: 2 },
        { value: 'full', slot: 1, count: 1 },
        { value: 'limited', slot: 2, count: 1 },
      ],
      otherCount: 0,
    });
  });

  it('sizes circles by the numeric value attribute automatically', () => {
    const [style] = styleOf({}, parkingLayer());
    expect(style?.size).toEqual({ kind: 'range', field: 'value', min: 0, max: 12 });
  });

  it('colours by a numeric field as a range', () => {
    const [style] = styleOf({ colorBy: 'value' }, parkingLayer());
    expect(style?.color).toEqual({ kind: 'range', field: 'value', min: 0, max: 12 });
  });

  it('lets the configuration name any field, such as one only this municipality has', () => {
    const trees = layer('trees', [
      point('a', 10, 51, { crownDiameter: 4, species: 'Oak' }),
      point('b', 10, 51.1, { crownDiameter: 9, species: 'Beech' }),
    ]);
    const [style] = styleOf({ colorBy: 'species', sizeBy: 'crownDiameter' }, trees);
    expect(style?.color).toMatchObject({ kind: 'categories', field: 'species' });
    expect(style?.size).toEqual({ kind: 'range', field: 'crownDiameter', min: 4, max: 9 });
  });

  it('falls back to its own fields when the configured one does not exist in a layer', () => {
    const [parking, districts] = styleOf({ colorBy: 'species' }, parkingLayer(), districtsLayer());
    expect(parking?.color).toMatchObject({ kind: 'categories', field: 'status' });
    expect(districts?.color).toEqual({ kind: 'fixed', slot: 1 });
  });

  it('gives each layer without categories its own colour so layers stay distinguishable', () => {
    const styles = styleOf({}, layer('a', [point('1', 10, 51)]), layer('b', [point('2', 11, 51)]));
    expect(styles.map((style) => style.color)).toEqual([
      { kind: 'fixed', slot: 0 },
      { kind: 'fixed', slot: 1 },
    ]);
  });

  it('groups the values beyond the palette into one shared "other"', () => {
    const features = Array.from({ length: 9 }, (_, i) =>
      point(`p${i}`, 10, 51 + i / 10, { status: `s${i}` }),
    );
    const [style] = styleOf({}, layer('many', features));
    expect(style?.color).toMatchObject({ kind: 'categories', otherCount: 9 - (PALETTE_SIZE - 1) });
    expect(style?.color.kind === 'categories' && style.color.entries).toHaveLength(
      PALETTE_SIZE - 1,
    );
  });

  it('ignores size for markers and clusters', () => {
    expect(styleOf({ pointStyle: 'markers' }, parkingLayer())[0]?.size).toEqual({ kind: 'fixed' });
    expect(styleOf({ pointStyle: 'clusters' }, parkingLayer())[0]?.size).toEqual({ kind: 'fixed' });
  });

  it('weights a heatmap by the numeric attribute', () => {
    expect(styleOf({ pointStyle: 'heatmap' }, parkingLayer())[0]?.size).toMatchObject({
      kind: 'range',
      field: 'value',
    });
  });

  it('records which geometry kinds a layer has, for the legend symbols', () => {
    const mixed = layer('mixed', [
      point('a', 10, 51),
      {
        id: 'l',
        label: 'Line',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        attributes: {},
      },
    ]);
    expect(styleOf({}, mixed)[0]?.families).toEqual(['point', 'line']);
  });
});
