import { parseHexColor } from '@lib/utils';

import { PALETTE_SIZE } from '../../application/contracts/map-constraints';

import type { LayerStyle } from '../../application/contracts/map-constraints';
import type { ExpressionSpecification } from 'mapbox-gl';

/** Concrete colours: Mapbox paints on a canvas and cannot read CSS variables. */
export interface ResolvedPalette {
  readonly series: readonly string[];
  readonly other: string;
  readonly rangeLow: string;
  readonly rangeHigh: string;
  readonly outline: string;
  readonly highlight: string;
  readonly onCluster: string;
}

/** One dataset's layers: their id prefix, their source, how they look and this map's resolved colours. */
export interface LayerInput {
  readonly id: string;
  readonly source: string;
  readonly style: LayerStyle;
  readonly palette: ResolvedPalette;
}

export const TRANSPARENT: ExpressionSpecification = ['rgba', 0, 0, 0, 0];

export const POINT_TYPES = ['Point', 'MultiPoint'];
export const LINE_TYPES = ['LineString', 'MultiLineString'];
export const AREA_TYPES = ['Polygon', 'MultiPolygon'];

export const isGeometry = (types: readonly string[]): ExpressionSpecification => [
  'in',
  ['geometry-type'],
  ['literal', types],
];

export function numberOf(field: string, fallback: number): ExpressionSpecification {
  return ['to-number', ['get', field], fallback];
}

export function colorExpression(
  style: LayerStyle,
  palette: ResolvedPalette,
): string | ExpressionSpecification {
  const { color } = style;
  switch (color.kind) {
    case 'fixed':
      return palette.series[color.slot % PALETTE_SIZE] ?? palette.other;
    case 'categories': {
      const pairs = color.entries.flatMap((entry) => [
        entry.value,
        palette.series[entry.slot] ?? palette.other,
      ]);
      return [
        'match',
        ['to-string', ['get', color.field]],
        ...pairs,
        palette.other,
      ] as ExpressionSpecification;
    }
    case 'range':
      return [
        'interpolate',
        ['linear'],
        numberOf(color.field, color.min),
        color.min,
        palette.rangeLow,
        color.max,
        palette.rangeHigh,
      ];
  }
}

/** The same colour with transparency, for the low end of a density ramp. Written as an expression, not a CSS string. */
export function withAlpha(hex: string, alpha: number): string | ExpressionSpecification {
  const color = parseHexColor(hex);
  return color === null ? hex : ['rgba', color.red, color.green, color.blue, alpha];
}
