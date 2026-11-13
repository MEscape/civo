'use client';

import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

import { clamp } from '@lib/utils';

/** Room kept between a panel and the edge of the window, and between a panel and its anchor. */
const EDGE_PX = 8;
const GAP_PX = 8;

/**
 * Keeps an open panel (`position: fixed`) beside the element it belongs to: below it when there is
 * room, above it when there is more room there, and never across the edge of the window. A fixed
 * panel is not cut off by the `overflow-hidden` of a card or list around its button, which an absolute
 * one is. It stays in the document where the button is, so the keyboard order and the way
 * outside presses are recognised do not change. The position is written to the element directly (no
 * state), before the browser paints, and again whenever the page scrolls or the window changes.
 * A panel with `data-width="anchor"` is as wide as the element it belongs to (a list under its field).
 */
export function useAnchoredPosition(
  isOpen: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  /** The panel's `id`: it is found by it (a ref handed around would have to be read during render), and says which edge it lines up with in `data-align` (`start` by default) and whether it is as wide as the anchor in `data-width`. */
  panelId: string,
): void {
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = document.getElementById(panelId);
      if (anchor === undefined || panel === null) {
        return;
      }
      if (panel.dataset['width'] === 'anchor') {
        panel.style.width = `${String(anchor.width)}px`;
      }
      const { width, height } = panel.getBoundingClientRect();
      const room = {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      };
      const below = room.height - anchor.bottom - GAP_PX - EDGE_PX;
      const above = anchor.top - GAP_PX - EDGE_PX;
      const fitsBelow = height <= below || below >= above;
      const top = fitsBelow ? anchor.bottom + GAP_PX : anchor.top - GAP_PX - height;
      panel.style.top = `${String(clamp(top, EDGE_PX, Math.max(EDGE_PX, room.height - height - EDGE_PX)))}px`;
      const left = panel.dataset['align'] === 'end' ? anchor.right - width : anchor.left;
      panel.style.left = `${String(clamp(left, EDGE_PX, Math.max(EDGE_PX, room.width - width - EDGE_PX)))}px`;
    };
    place();
    // A month with six weeks is taller than one with five: the panel grows and may need to move up.
    const observer = new ResizeObserver(place);
    const panel = document.getElementById(panelId);
    if (panel !== null) {
      observer.observe(panel);
    }
    window.addEventListener('resize', place);
    // Capture: a scrolling list or dialog around the button moves it as well, and its scroll does not bubble.
    document.addEventListener('scroll', place, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, { capture: true });
    };
  }, [isOpen, anchorRef, panelId]);
}
