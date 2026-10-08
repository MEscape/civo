import type {
  DropPosition,
  DropTarget,
  PageNodeId,
  Rect,
} from '../../application/contracts/editor-model';

export interface IndicatorRect extends Rect {
  readonly position: DropPosition;
}

/** Thickness of the insertion line drawn between siblings. */
export const INSERTION_LINE_THICKNESS_PX = 4;

interface IndicatorInput {
  readonly target: DropTarget | null;
  /** Layout of every rendered node, relative to the canvas container. */
  readonly rects: ReadonlyMap<PageNodeId, Rect>;
  /** The canvas container's own size, for a drop into an empty page. */
  readonly containerSize: { readonly width: number; readonly height: number } | null;
}

/**
 * Where the drop indicator is drawn for `target`: a line before or after a
 * node, an outline around the node it would nest into, or the whole canvas
 * for the page root. Pure, so it is tested without a DOM.
 */
export function indicatorRectFor(input: IndicatorInput): IndicatorRect | null {
  const { target, rects, containerSize } = input;
  if (target === null) {
    return null;
  }

  if (target.kind === 'root') {
    return containerSize === null
      ? null
      : { top: 0, left: 0, ...containerSize, position: 'inside' };
  }

  const rect = rects.get(target.targetNodeId);
  if (rect === undefined) {
    return null;
  }
  if (target.kind === 'inside') {
    return { ...rect, position: 'inside' };
  }

  const edge = target.position === 'before' ? rect.top : rect.top + rect.height;
  return {
    ...rect,
    top: edge - INSERTION_LINE_THICKNESS_PX / 2,
    height: INSERTION_LINE_THICKNESS_PX,
    position: target.position,
  };
}
