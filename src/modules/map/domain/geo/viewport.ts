import { clamp } from '@lib/utils';

import type { Bounds } from './geometry';

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const INITIAL_MAX_LATITUDE = 85;
export const DEFAULT_MAP_BOUNDS: Bounds = [
  -MAX_LONGITUDE,
  -INITIAL_MAX_LATITUDE,
  MAX_LONGITUDE,
  INITIAL_MAX_LATITUDE,
];

/** Clip a small buffer at world edges, so an edge viewport never becomes a whole-world read. */
export function padViewport(bounds: Bounds, padding: number): Bounds {
  const [west, south, east, north] = bounds;
  const width = east - west;
  const horizontal = width * padding;
  const vertical = (north - south) * padding;
  return [
    clamp(west - horizontal, -MAX_LONGITUDE, MAX_LONGITUDE),
    clamp(south - vertical, -MAX_LATITUDE, MAX_LATITUDE),
    clamp(east + horizontal, -MAX_LONGITUDE, MAX_LONGITUDE),
    clamp(north + vertical, -MAX_LATITUDE, MAX_LATITUDE),
  ];
}
