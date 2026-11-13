import { clamp } from '@lib/utils';

import { GEO_LIMITS, isValidCoordinate } from './geometry';

import type { Bounds } from './geometry';

const MIN_PADDING_DEGREES = 0.01;
const PADDING_RATIO = 0.1;

/** A usable starting area around valid locations, including a single pin at a world edge. */
export function boundsForLocations(
  locations: ReadonlyArray<{ readonly longitude: number; readonly latitude: number }>,
): Bounds | null {
  const valid = locations.filter(({ longitude, latitude }) =>
    isValidCoordinate(longitude, latitude),
  );
  const first = valid[0];
  if (first === undefined) {
    return null;
  }

  let west = first.longitude;
  let south = first.latitude;
  let east = first.longitude;
  let north = first.latitude;
  for (const location of valid) {
    west = Math.min(west, location.longitude);
    south = Math.min(south, location.latitude);
    east = Math.max(east, location.longitude);
    north = Math.max(north, location.latitude);
  }

  const horizontal = Math.max(MIN_PADDING_DEGREES, (east - west) * PADDING_RATIO);
  const vertical = Math.max(MIN_PADDING_DEGREES, (north - south) * PADDING_RATIO);
  return [
    clamp(west - horizontal, -GEO_LIMITS.longitude, GEO_LIMITS.longitude),
    clamp(south - vertical, -GEO_LIMITS.latitude, GEO_LIMITS.latitude),
    clamp(east + horizontal, -GEO_LIMITS.longitude, GEO_LIMITS.longitude),
    clamp(north + vertical, -GEO_LIMITS.latitude, GEO_LIMITS.latitude),
  ];
}
