import { parseHexColor } from '@lib/utils';

import { PALETTE_SIZE } from '../../application/contracts/map-constraints';

import type { LayerStyle, PointStyle } from '../../application/contracts/map-constraints';
import type { LayerSpecification, ExpressionSpecification } from 'mapbox-gl';

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

/** Feature property that carries the feature key into Mapbox. */
export const KEY_PROPERTY = '__key';

const POINT_RADIUS = 7;
const CIRCLE_RADIUS_MIN = 6;
const CIRCLE_RADIUS_MAX = 22;
const HIGHLIGHT_RADIUS = 14;
const LINE_WIDTH = 3;
const AREA_OPACITY = 0.35;
const CIRCLE_OPACITY = 0.8;
const CLUSTER_STEPS = { small: 16, medium: 20, large: 26, mediumFrom: 10, largeFrom: 50 } as const;
const HEATMAP_FADE = { from: 12, to: 15 } as const;
const HEATMAP_RADIUS = { atZoom0: 6, atZoom15: 40 } as const;
const MAX_ZOOM_FOR_ZOOM_EXPRESSIONS = 15;
const TEXT_SIZE = 12;
const CLUSTER_FONT = ['DIN Pro Medium', 'Arial Unicode MS Bold'];
const TRANSPARENT: ExpressionSpecification = ['rgba', 0, 0, 0, 0];

const POINT_TYPES = ['Point', 'MultiPoint'];
const LINE_TYPES = ['LineString', 'MultiLineString'];
const AREA_TYPES = ['Polygon', 'MultiPolygon'];

const isGeometry = (types: readonly string[]): ExpressionSpecification => [
  'in',
  ['geometry-type'],
  ['literal', types],
];

function numberOf(field: string, fallback: number): ExpressionSpecification {
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

function radiusExpression(style: LayerStyle): number | ExpressionSpecification {
  if (style.pointStyle !== 'circles' || style.size.kind === 'fixed') {
    return POINT_RADIUS;
  }
  const { field, min, max } = style.size;
  return [
    'interpolate',
    ['linear'],
    numberOf(field, min),
    min,
    CIRCLE_RADIUS_MIN,
    max,
    CIRCLE_RADIUS_MAX,
  ];
}

/** The lightest feature still weighs this much, so a small value never vanishes from the heatmap. */
const HEATMAP_MIN_WEIGHT = 0.2;
const HEATMAP_LOW_DENSITY = 0.2;
const HEATMAP_LOW_ALPHA = 0.6;
const HEATMAP_MAX_OPACITY = 0.9;
const CIRCLE_STROKE_WIDTH = 1.5;
const MARKER_STROKE_WIDTH = 2;

function heatmapWeight(style: LayerStyle): number | ExpressionSpecification {
  if (style.size.kind === 'fixed') {
    return 1;
  }
  const { field, min, max } = style.size;
  return ['interpolate', ['linear'], numberOf(field, min), min, HEATMAP_MIN_WEIGHT, max, 1];
}

/** The same colour with transparency, for the low end of a density ramp. Written as an expression, not a CSS string. */
export function withAlpha(hex: string, alpha: number): string | ExpressionSpecification {
  const color = parseHexColor(hex);
  return color === null ? hex : ['rgba', color.red, color.green, color.blue, alpha];
}

/** One dataset's layers: their id prefix, their source, how they look and this map's resolved colours. */
interface LayerInput {
  readonly id: string;
  readonly source: string;
  readonly style: LayerStyle;
  readonly palette: ResolvedPalette;
}

function areaLayers({ id, source, style, palette }: LayerInput): LayerSpecification[] {
  const color = colorExpression(style, palette);
  return [
    {
      id: `${id}-area`,
      type: 'fill',
      source,
      filter: isGeometry(AREA_TYPES),
      paint: { 'fill-color': color, 'fill-opacity': AREA_OPACITY },
    },
    {
      id: `${id}-area-outline`,
      type: 'line',
      source,
      filter: isGeometry(AREA_TYPES),
      paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.9 },
    },
  ];
}

function lineLayers({ id, source, style, palette }: LayerInput): LayerSpecification[] {
  return [
    {
      id: `${id}-line`,
      type: 'line',
      source,
      filter: isGeometry(LINE_TYPES),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colorExpression(style, palette), 'line-width': LINE_WIDTH },
    },
  ];
}

function dotLayer(
  { id, source, style, palette }: LayerInput,
  filter: ExpressionSpecification,
): LayerSpecification {
  const isCircles = style.pointStyle === 'circles';
  return {
    id,
    type: 'circle',
    source,
    filter,
    paint: {
      'circle-color': colorExpression(style, palette),
      'circle-radius': radiusExpression(style),
      'circle-opacity': isCircles ? CIRCLE_OPACITY : 1,
      'circle-stroke-color': palette.outline,
      'circle-stroke-width': isCircles ? CIRCLE_STROKE_WIDTH : MARKER_STROKE_WIDTH,
    },
  };
}

function pointLayers({ id, source, style, palette }: LayerInput): LayerSpecification[] {
  const points = isGeometry(POINT_TYPES);
  const byStyle: Record<PointStyle, () => LayerSpecification[]> = {
    markers: () => [dotLayer({ id: `${id}-point`, source, style, palette }, points)],
    circles: () => [dotLayer({ id: `${id}-point`, source, style, palette }, points)],
    clusters: () => [
      {
        id: `${id}-cluster`,
        type: 'circle',
        source,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': palette.series[0] ?? palette.other,
          'circle-stroke-color': palette.outline,
          'circle-stroke-width': 2,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            CLUSTER_STEPS.small,
            CLUSTER_STEPS.mediumFrom,
            CLUSTER_STEPS.medium,
            CLUSTER_STEPS.largeFrom,
            CLUSTER_STEPS.large,
          ],
        },
      },
      {
        id: `${id}-cluster-count`,
        type: 'symbol',
        source,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': CLUSTER_FONT,
          'text-size': TEXT_SIZE,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': palette.onCluster },
      },
      dotLayer({ id: `${id}-point`, source, style, palette }, [
        'all',
        points,
        ['!', ['has', 'point_count']],
      ]),
    ],
    heatmap: () => [
      {
        id: `${id}-heat`,
        type: 'heatmap',
        source,
        filter: points,
        paint: {
          'heatmap-weight': heatmapWeight(style),
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            HEATMAP_RADIUS.atZoom0,
            MAX_ZOOM_FOR_ZOOM_EXPRESSIONS,
            HEATMAP_RADIUS.atZoom15,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            TRANSPARENT,
            HEATMAP_LOW_DENSITY,
            withAlpha(palette.rangeLow, HEATMAP_LOW_ALPHA),
            1,
            palette.rangeHigh,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            HEATMAP_FADE.from,
            HEATMAP_MAX_OPACITY,
            HEATMAP_FADE.to,
            0,
          ],
        },
      },
      // Dense areas become unreadable blobs when zoomed in; individual locations take over there.
      {
        ...dotLayer({ id: `${id}-point`, source, style, palette }, points),
        minzoom: HEATMAP_FADE.from,
      } as LayerSpecification,
    ],
  };
  return byStyle[style.pointStyle]();
}

export interface LayerGroups {
  readonly areas: readonly LayerSpecification[];
  readonly lines: readonly LayerSpecification[];
  readonly points: readonly LayerSpecification[];
  readonly highlights: readonly LayerSpecification[];
  /** Layers a click may hit; the heat layer and decorations are excluded. */
  readonly interactiveIds: readonly string[];
  readonly clusterIds: readonly string[];
}

function highlightLayers({ id, source, palette }: LayerInput): LayerSpecification[] {
  const none: ExpressionSpecification = ['==', ['get', KEY_PROPERTY], ''];
  return [
    {
      id: `${id}-hl-area`,
      type: 'line',
      source,
      filter: ['all', isGeometry(AREA_TYPES), none],
      paint: { 'line-color': palette.highlight, 'line-width': 4 },
    },
    {
      id: `${id}-hl-line`,
      type: 'line',
      source,
      filter: ['all', isGeometry(LINE_TYPES), none],
      paint: { 'line-color': palette.highlight, 'line-width': LINE_WIDTH * 2, 'line-opacity': 0.6 },
    },
    {
      id: `${id}-hl-point`,
      type: 'circle',
      source,
      filter: ['all', isGeometry(POINT_TYPES), none],
      paint: {
        'circle-color': TRANSPARENT,
        'circle-radius': HIGHLIGHT_RADIUS,
        'circle-stroke-color': palette.highlight,
        'circle-stroke-width': 3,
      },
    },
  ];
}

export function highlightFilters(
  key: string | null,
): Record<'area' | 'line' | 'point', ExpressionSpecification> {
  const match: ExpressionSpecification = ['==', ['get', KEY_PROPERTY], key ?? ''];
  return {
    area: ['all', isGeometry(AREA_TYPES), match],
    line: ['all', isGeometry(LINE_TYPES), match],
    point: ['all', isGeometry(POINT_TYPES), match],
  };
}

/** The Mapbox layers one `LayerStyle` needs. The only place style decisions become Mapbox syntax. */
export function buildLayerGroups({
  layerId,
  sourceId,
  style,
  palette,
}: {
  readonly layerId: string;
  readonly sourceId: string;
  readonly style: LayerStyle;
  readonly palette: ResolvedPalette;
}): LayerGroups {
  const input: LayerInput = { id: layerId, source: sourceId, style, palette };
  const areas = areaLayers(input);
  const lines = lineLayers(input);
  const points = pointLayers(input);
  const highlights = highlightLayers(input);

  return {
    areas,
    lines,
    points,
    highlights,
    interactiveIds: [...areas, ...lines, ...points]
      .map((layer) => layer.id)
      .filter(
        (id) =>
          !id.endsWith('-heat') && !id.endsWith('-cluster-count') && !id.endsWith('-area-outline'),
      ),
    clusterIds: points.map((layer) => layer.id).filter((id) => id.endsWith('-cluster')),
  };
}
