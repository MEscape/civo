'use client';

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The height `element` will have after being scaled by `scale`. A CSS
 * transform does not shrink an element's layout box, so a scaled preview
 * needs its wrapper sized to the post-scale height or it leaves a tall
 * empty gap. Synchronizes with the browser's layout through a
 * ResizeObserver, which is what effects are for.
 */
export function useScaledHeight(
  elementRef: RefObject<HTMLElement | null>,
  scale: number,
  isActive: boolean,
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!isActive || element === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setHeight(entry.contentRect.height * scale);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [elementRef, scale, isActive]);

  return height;
}
