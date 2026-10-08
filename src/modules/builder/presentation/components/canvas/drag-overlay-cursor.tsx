import { useEffect, useRef } from 'react';

import type { DragSession } from '../../dnd/canvas-drag-controller';

const CURSOR_OFFSET_PX = 12;
const OFFSCREEN_TRANSFORM = 'translate(-9999px, -9999px)';

export interface DragOverlayCursorProps {
  readonly session: DragSession | null;
  readonly isKeyboard: boolean;
}

/**
 * The label that follows the pointer during a drag. Positioned by writing
 * the element's transform directly: re-rendering on every pointer move
 * would cost far more than it is worth. React only rewrites the style when
 * the prop changes, and the prop never does, so it does not undo this.
 * Hidden from assistive technology: `DragAnnouncer` speaks for keyboard drags.
 */
export function DragOverlayCursor({ session, isKeyboard }: DragOverlayCursorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isFollowingPointer = session !== null && !isKeyboard;

  useEffect(() => {
    if (!isFollowingPointer) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent): void {
      const overlay = overlayRef.current;
      if (overlay === null) {
        return;
      }
      overlay.style.transform = `translate(${
        event.clientX + CURSOR_OFFSET_PX
      }px, ${event.clientY + CURSOR_OFFSET_PX}px)`;
    }

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isFollowingPointer]);

  if (session === null || isKeyboard) {
    return null;
  }
  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 rounded-token border border-border bg-surface px-3 py-1.5 text-sm font-medium text-copy opacity-90 shadow-lg"
      style={{ transform: OFFSCREEN_TRANSFORM }}
    >
      {session.label}
    </div>
  );
}
