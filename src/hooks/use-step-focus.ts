'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Moves focus to a step's heading when the step changes, so a keyboard or screen-reader user starts
 * where the new content starts. It compares with what was shown, so the first render and a
 * strict-mode re-run do not steal focus.
 */
export function useStepFocus(currentKey: string) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownKey = useRef(currentKey);

  useEffect(() => {
    if (shownKey.current !== currentKey) {
      shownKey.current = currentKey;
      headingRef.current?.focus();
    }
  }, [currentKey]);

  return { headingId, headingRef };
}
