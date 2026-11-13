import {
  LINE_TYPES,
  AREA_TYPES,
  POINT_TYPES,
  TRANSPARENT,
  colorExpression,
  isGeometry,
} from './mapbox-expressions';
import { pointLayers } from './mapbox-point-layers';

import type { LayerInput, ResolvedPalette } from './mapbox-expressions';
import type { LayerStyle } from '../../application/contracts/map-constraints';
import type { ExpressionSpecification, LayerSpecification } from 'mapbox-gl';

/** Feature property that carries the feature key into Mapbox. */
export const KEY_PROPERTY = '__key';

const HIGHLIGHT_RADIUS = 14;
const LINE_WIDTH = 3;
const AREA_OPACITY = 0.35;

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
