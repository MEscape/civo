/** A pointer must travel this far before a press becomes a drag, so plain clicks stay clicks. */
export const ACTIVATION_DISTANCE_PX = 4;

interface Point {
  readonly x: number;
  readonly y: number;
}

export function hasExceededActivationDistance(start: Point, current: Point): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= ACTIVATION_DISTANCE_PX;
}
