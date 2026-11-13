import type { MapHeight } from '../../../application/contracts/map-constraints';

/**
 * The box every map is drawn in: the editor's preview, the page editor and the public page. A
 * placeholder in a map's place uses the same classes, so nothing jumps when the map arrives.
 */
export const MAP_FRAME_CLASS = 'overflow-hidden rounded-token border border-border bg-canvas';

/** The heights a map can be configured with; the container query lets a tall map grow on wide pages. */
export const MAP_HEIGHT_CLASSES: Record<MapHeight, string> = {
  compact: 'h-72',
  standard: 'h-96',
  tall: 'h-96 @3xl:h-144',
};
