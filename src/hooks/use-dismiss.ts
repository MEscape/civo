'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export type DismissReason = 'escape' | 'outside';

/**
 * Closes a popup that is open (a disclosure, a date picker) when the user
 * presses a pointer outside `rootRef` or hits Escape. The caller owns the
 * state and decides what each reason means (typically: close, and on
 * `'escape'` hand focus back to the trigger). Escape is consumed, so a popup
 * inside a modal `<dialog>` closes alone instead of closing the dialog too.
 */
export function useDismiss(
  isOpen: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void,
): void {
  // Read through a ref so a new callback on every render does not resubscribe the listeners.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handlePointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        dismissRef.current('outside');
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current('escape');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, rootRef]);
}
