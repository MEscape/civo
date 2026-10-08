import { parsePageNodeId } from '../../application/contracts/editor-model';

import type { PageNodeId, Rect } from '../../application/contracts/editor-model';

/** Set by the component renderer in edit mode on every node's root element. */
export const NODE_ID_ATTRIBUTE = 'data-civo-node-id';
const NODE_SELECTOR = `[${NODE_ID_ATTRIBUTE}]`;

/** The id of the nearest node at or above `target`. Ids from the DOM are re-validated. */
export function findNodeId(target: EventTarget | null): PageNodeId | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const raw = target.closest(NODE_SELECTOR)?.getAttribute(NODE_ID_ATTRIBUTE);
  return raw ? parsePageNodeId(raw).unwrapOr(null) : null;
}

function relativeRect(element: Element, container: Element): Rect {
  const box = element.getBoundingClientRect();
  const origin = container.getBoundingClientRect();
  return {
    top: box.top - origin.top,
    left: box.left - origin.left,
    width: box.width,
    height: box.height,
  };
}

/** Rects of every node, relative to `container`, which is where the overlay's coordinates start. */
export function measureAllNodeRects(container: Element): Map<PageNodeId, Rect> {
  const rects = new Map<PageNodeId, Rect>();
  for (const element of container.querySelectorAll(NODE_SELECTOR)) {
    const id = findNodeId(element);
    if (id !== null) {
      rects.set(id, relativeRect(element, container));
    }
  }
  return rects;
}
