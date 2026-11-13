import { geometryBounds } from '../../../application/contracts/map-constraints';

import type {
  Bounds,
  GeoGeometry,
  MapFeature,
  Position,
} from '../../../application/contracts/map-constraints';

const WIDTH = 800;
const HEIGHT = 480;
const PADDING = 24;
const MIN_SPAN = 0.002;
const DEGREES = 180;
const MIN_LONGITUDE_SCALE = 0.01;

/** A local equirectangular projection, corrected for latitude, for bounded civic datasets. */
export function vectorProjection(bounds: Bounds) {
  const [west, south, east, north] = bounds;
  const longitudeScale = Math.max(
    MIN_LONGITUDE_SCALE,
    Math.cos((((south + north) / 2) * Math.PI) / DEGREES),
  );
  const scale = Math.min(
    (WIDTH - 2 * PADDING) / Math.max((east - west) * longitudeScale, MIN_SPAN),
    (HEIGHT - 2 * PADDING) / Math.max(north - south, MIN_SPAN),
  );
  return ([longitude, latitude]: Position): Position => [
    WIDTH / 2 + (longitude - (west + east) / 2) * longitudeScale * scale,
    HEIGHT / 2 - (latitude - (south + north) / 2) * scale,
  ];
}

/** Draw area context first so district polygons never obscure point locations. */
export function vectorFeatures(
  layers: ReadonlyArray<{ readonly features: readonly MapFeature[] }>,
): readonly MapFeature[] {
  const order = { area: 0, line: 1, point: 2 } as const;
  return layers
    .flatMap((layer) => layer.features)
    .sort((a, b) => order[a.family] - order[b.family]);
}

export function vectorViewBox(
  zoom: number,
  selected: MapFeature | undefined,
  project: (position: Position) => Position,
): string {
  const bounds = selected === undefined ? undefined : geometryBounds(selected.geometry);
  const center =
    bounds === undefined || zoom === 1
      ? [WIDTH / 2, HEIGHT / 2]
      : project([(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]);
  const width = WIDTH / zoom;
  const height = HEIGHT / zoom;
  return `${center[0] - width / 2} ${center[1] - height / 2} ${width} ${height}`;
}

export function vectorPaths(
  geometry: GeoGeometry,
  project: (position: Position) => Position,
): readonly string[] {
  const line = (positions: readonly Position[], closed = false) =>
    positions
      .map(
        (position, index) =>
          `${index === 0 ? 'M' : 'L'}${project(position)
            .map((value) => value.toFixed(2))
            .join(',')}`,
      )
      .join(' ') + (closed ? ' Z' : '');
  switch (geometry.type) {
    case 'Point':
      return [pointPath(project(geometry.coordinates))];
    case 'MultiPoint':
      return geometry.coordinates.map((position) => pointPath(project(position)));
    case 'LineString':
      return [line(geometry.coordinates)];
    case 'MultiLineString':
      return geometry.coordinates.map((positions) => line(positions));
    case 'Polygon':
      return [geometry.coordinates.map((ring) => line(ring, true)).join(' ')];
    case 'MultiPolygon':
      return geometry.coordinates.map((polygon) =>
        polygon.map((ring) => line(ring, true)).join(' '),
      );
  }
}

/**
 * The places of the heatmap layers and where they glow. Only points glow: the districts or routes
 * of the same layer stay drawn as they are.
 */
export function vectorHeat(
  layers: ReadonlyArray<{ readonly layerId: string; readonly features: readonly MapFeature[] }>,
  heatmapLayerIds: readonly string[],
  project: (position: Position) => Position,
): { readonly keys: ReadonlySet<string>; readonly points: readonly Position[] } {
  const places = layers
    .filter((layer) => heatmapLayerIds.includes(layer.layerId))
    .flatMap((layer) => layer.features.filter((feature) => feature.family === 'point'));
  return {
    keys: new Set(places.map((feature) => feature.key)),
    points: places.flatMap((feature) => vectorPoints(feature.geometry, project)),
  };
}

/** The projected positions of a point geometry; lines and areas have none. */
function vectorPoints(
  geometry: GeoGeometry,
  project: (position: Position) => Position,
): readonly Position[] {
  switch (geometry.type) {
    case 'Point':
      return [project(geometry.coordinates)];
    case 'MultiPoint':
      return geometry.coordinates.map(project);
    default:
      return [];
  }
}

function pointPath([x, y]: Position): string {
  const radius = 6;
  return `M${x - radius},${y} a${radius},${radius} 0 1,0 ${radius * 2},0 a${radius},${radius} 0 1,0 ${-radius * 2},0`;
}
