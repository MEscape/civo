import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { measureAllNodeRects } from '../dom/node-dom';

import type { PageNodeId, Rect } from '../../application/contracts/editor-model';

const NO_RECTS: ReadonlyMap<PageNodeId, Rect> = new Map();

/**
 * Layout of every rendered node, measured after render and again whenever
 * the canvas resizes (viewport switch, content growth). Measuring happens
 * in an effect, never during render, and a ResizeObserver replaces
 * waiting for a CSS transition to end.
 */
export function useNodeRects(
  containerRef: RefObject<HTMLElement | null>,
  renderedContent: unknown,
): ReadonlyMap<PageNodeId, Rect> {
  const [rects, setRects] = useState(NO_RECTS);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return undefined;
    }

    const update = () => {
      setRects(measureAllNodeRects(container));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [containerRef, renderedContent]);

  return rects;
}
