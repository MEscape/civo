import { describe, expect, it } from 'vitest';

import type { MapConfig } from '@modules/map';
import {
  buildLayerGroups,
  colorExpression,
  highlightFilters,
  withAlpha,
} from '@modules/map/presentation/mapbox/mapbox-layers';
import type { ResolvedPalette } from '@modules/map/presentation/mapbox/mapbox-layers';

import { layer, parkingLayer, point, prepareMap } from './fixtures';

const PALETTE: ResolvedPalette = {
  series: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'],
  other: '#999999',
  rangeLow: '#aaaaaa',
  rangeHigh: '#bbbbbb',
  outline: '#ffffff',
  highlight: '#ff0000',
  onCluster: '#ffffff',
};

const BASE: MapConfig = {
  pointStyle: 'circles',
  interaction: 'details',
  showFilters: true,
  showLegend: true,
};

function groupsFor(config: Partial<MapConfig>, input = parkingLayer()) {
  const [style] = prepareMap([input], { ...BASE, ...config }).styles;
  if (style === undefined) {
    throw new Error('expected one style');
  }
  return {
    style,
    groups: buildLayerGroups({
      layerId: input.id,
      sourceId: `src-${input.id}`,
      style,
      palette: PALETTE,
    }),
  };
}

describe('the Mapbox translation uses the same encoding the legend is built from', () => {
  it('maps every category entry of the legend to its palette colour', () => {
    const { style } = groupsFor({});
    const expression = colorExpression(style, PALETTE);

    expect(expression).toEqual([
      'match',
      ['to-string', ['get', 'status']],
      'available',
      '#111111',
      'full',
      '#222222',
      'limited',
      '#333333',
      '#999999',
    ]);
  });

  it('interpolates a numeric colour between the two range colours', () => {
    const { style } = groupsFor({ colorBy: 'value' });
    expect(colorExpression(style, PALETTE)).toEqual([
      'interpolate',
      ['linear'],
      ['to-number', ['get', 'value'], 0],
      0,
      '#aaaaaa',
      12,
      '#bbbbbb',
    ]);
  });

  it('uses one fixed colour when the layer has nothing to distinguish by', () => {
    const { style } = groupsFor({}, layer('x', [point('a', 10, 51)]));
    expect(colorExpression(style, PALETTE)).toBe('#111111');
  });
});

describe('layers per visualization', () => {
  const ids = (config: Partial<MapConfig>) => groupsFor(config).groups.points.map((l) => l.id);

  it.each([
    ['circles', ['parking-point']],
    ['markers', ['parking-point']],
    ['clusters', ['parking-cluster', 'parking-cluster-count', 'parking-point']],
    ['heatmap', ['parking-heat', 'parking-point']],
  ] as const)('%s', (pointStyle, expected) => {
    expect(ids({ pointStyle })).toEqual(expected);
  });

  it('does not make the heat layer or cluster labels clickable, but lets clusters be expanded', () => {
    const { groups } = groupsFor({ pointStyle: 'clusters' });
    expect(groups.interactiveIds).toContain('parking-cluster');
    expect(groups.interactiveIds).not.toContain('parking-cluster-count');
    expect(groups.clusterIds).toEqual(['parking-cluster']);
    expect(groupsFor({ pointStyle: 'heatmap' }).groups.interactiveIds).not.toContain(
      'parking-heat',
    );
  });

  it('draws areas and lines for those geometries regardless of the point style', () => {
    const { groups } = groupsFor({ pointStyle: 'heatmap' });
    expect(groups.areas.map((l) => l.id)).toEqual(['parking-area', 'parking-area-outline']);
    expect(groups.lines.map((l) => l.id)).toEqual(['parking-line']);
  });

  it('highlights only the selected feature, and nothing when nothing is selected', () => {
    expect(highlightFilters('parking:a').point).toEqual([
      'all',
      ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
      ['==', ['get', '__key'], 'parking:a'],
    ]);
    expect(highlightFilters(null).point[2]).toEqual(['==', ['get', '__key'], '']);
  });
});

describe('withAlpha', () => {
  it('adds transparency to a hex colour', () => {
    expect(withAlpha('#ff8000', 0.5)).toEqual(['rgba', 255, 128, 0, 0.5]);
  });
});
