import { geometryBounds, parseGeometry, pointFromCoordinates } from './geometry';

import type { Bounds } from './geometry';

/** The part of a located record the window test needs: where it is, as the host handed it over. */
interface Located {
  readonly geometry?: unknown;
  readonly latitude?: number | undefined;
  readonly longitude?: number | undefined;
}

/** The box around a record's place, or `null` when it has none a map could draw (the same rule the layers use). */
export function placeBounds(record: Located): Bounds | null {
  const declared = record.geometry === undefined ? undefined : parseGeometry(record.geometry);
  const geometry =
    declared?.isOk() === true ? declared : pointFromCoordinates(record.latitude, record.longitude);
  return geometry.isOk() ? geometryBounds(geometry.value) : null;
}

/** Whether two boxes share any area, edges included: a shape reaching into the window belongs to it. */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
