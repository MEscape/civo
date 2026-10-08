import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

import { hasCapability } from '../../application/contracts/editor-model';
import { useBuilderSession } from '../components/builder-session-context';
import { createCanvasDragController } from '../dnd/canvas-drag-controller';
import { useBuilderDispatch, useBuilderSelector, useBuilderStore } from '../state/builder-hooks';
import { selectMode } from '../state/builder-selectors';
import { applyDrop } from '../state/editing-thunks';

import { useComponentText } from './use-component-text';

import type { PageNodeId } from '../../application/contracts/editor-model';
import type { DragState, KeyEventLike } from '../dnd/canvas-drag-controller';

export interface CanvasDnd extends DragState {
  beginPaletteDrag(componentType: string): void;
  movePalettePointer(clientX: number, clientY: number): void;
  drop(): void;
  cancel(): void;
  handleGripKeyDown(nodeId: PageNodeId, event: KeyEventLike): void;
}

/**
 * React adapter over the drag controller. The controller reads the tree
 * from the store at call time, so it never holds a stale copy.
 */
export function useCanvasDnd(containerRef: RefObject<HTMLElement | null>): CanvasDnd {
  const store = useBuilderStore();
  const dispatch = useBuilderDispatch();
  const { catalog } = useBuilderSession();
  const mode = useBuilderSelector(selectMode);
  const text = useComponentText();
  // The controller outlives renders; it reads the latest text through this ref.
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const [controller] = useState(() =>
    createCanvasDragController({
      getContainer: () => containerRef.current,
      getChildren: () => store.getState().document.history.present.children,
      isEnabled: () => hasCapability(store.getState().ui.editorMode, 'editStructure'),
      catalog,
      labelOf: (type) => textRef.current.componentLabel(type),
      onDrop: (session, target) => {
        dispatch(applyDrop(session, target));
      },
    }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  // `mode` is a dependency on purpose: leaving and re-entering preview mounts a new canvas element.
  useEffect(() => {
    const container = containerRef.current;
    return container === null ? undefined : controller.attach(container);
  }, [controller, containerRef, mode]);

  return {
    ...state,
    beginPaletteDrag: controller.beginPaletteDrag,
    movePalettePointer: controller.movePointer,
    drop: controller.drop,
    cancel: controller.cancel,
    handleGripKeyDown: controller.handleGripKey,
  };
}
