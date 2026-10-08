import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { hasExceededActivationDistance } from '../dnd/drag-activation';

import type { CanvasDnd } from './use-canvas-dnd';

type PaletteDndApi = Pick<CanvasDnd, 'beginPaletteDrag' | 'movePalettePointer' | 'drop' | 'cancel'>;

/**
 * Starts canvas drag sessions from palette items. The palette only STARTS
 * a drag; the controller resolves targets from there. A drag that ends on
 * the same button would still fire `click`, which `wasDragged` lets the
 * caller ignore.
 */
export function usePaletteDrag(dnd: PaletteDndApi) {
  const isDraggingRef = useRef(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>, componentType: string): void {
    if (event.button !== 0) {
      return;
    }
    const start = { x: event.clientX, y: event.clientY };
    isDraggingRef.current = false;

    function detach(): void {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      // Reset after the click that follows pointerup, which must still read `true`.
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    }

    function handleMove(moveEvent: PointerEvent): void {
      if (!isDraggingRef.current) {
        const current = { x: moveEvent.clientX, y: moveEvent.clientY };
        if (!hasExceededActivationDistance(start, current)) {
          return;
        }
        isDraggingRef.current = true;
        dnd.beginPaletteDrag(componentType);
      }
      dnd.movePalettePointer(moveEvent.clientX, moveEvent.clientY);
    }

    function handleUp(): void {
      if (isDraggingRef.current) {
        dnd.drop();
      }
      detach();
    }

    function handleCancel(): void {
      if (isDraggingRef.current) {
        dnd.cancel();
      }
      detach();
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
  }

  return { handlePointerDown, wasDragged: () => isDraggingRef.current };
}
