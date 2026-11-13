import {
  POINT_TYPES,
  TRANSPARENT,
  colorExpression,
  isGeometry,
  numberOf,
  withAlpha,
} from './mapbox-expressions';

import type { LayerInput } from './mapbox-expressions';
import type { LayerStyle, PointStyle } from '../../application/contracts/map-constraints';
import type { ExpressionSpecification, LayerSpecification } from 'mapbox-gl';

const POINT_RADIUS = 7;
const CIRCLE_RADIUS_MIN = 6;
const CIRCLE_RADIUS_MAX = 22;
const CIRCLE_OPACITY = 0.8;
const CLUSTER_STEPS = { small: 16, medium: 20, large: 26, mediumFrom: 10, largeFrom: 50 } as const;
const HEATMAP_FADE = { from: 12, to: 15 } as const;
const HEATMAP_RADIUS = { atZoom0: 6, atZoom15: 40 } as const;
const MAX_ZOOM_FOR_ZOOM_EXPRESSIONS = 15;
const TEXT_SIZE = 12;
const CLUSTER_FONT = ['DIN Pro Medium', 'Arial Unicode MS Bold'];

/** The lightest feature still weighs this much, so a small value never vanishes from the heatmap. */
const HEATMAP_MIN_WEIGHT = 0.2;
const HEATMAP_LOW_DENSITY = 0.2;
const HEATMAP_LOW_ALPHA = 0.6;
const HEATMAP_MAX_OPACITY = 0.9;
const CIRCLE_STROKE_WIDTH = 1.5;
const MARKER_STROKE_WIDTH = 2;

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

function heatmapWeight(style: LayerStyle): number | ExpressionSpecification {
  if (style.size.kind === 'fixed') {
    return 1;
  }
  const { field, min, max } = style.size;
  return ['interpolate', ['linear'], numberOf(field, min), min, HEATMAP_MIN_WEIGHT, max, 1];
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

export function pointLayers({ id, source, style, palette }: LayerInput): LayerSpecification[] {
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
