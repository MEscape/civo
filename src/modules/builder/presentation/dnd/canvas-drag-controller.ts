import { deepEqual } from '@lib/utils';

import {
  findNode,
  resolveDropTargetAtCanvasEnd,
  resolveDropTargetForNode,
  stepDropTarget,
} from '../../application/contracts/editor-model';
import { findNodeId, measureAllNodeRects } from '../dom/node-dom';

import { hasExceededActivationDistance } from './drag-activation';
import { indicatorRectFor } from './drop-indicator-rect';

import type { IndicatorRect } from './drop-indicator-rect';
import type {
  ActiveDrag,
  ComponentCatalog,
  DropTarget,
  PageNode,
  PageNodeId,
  Rect,
} from '../../application/contracts/editor-model';

/** What is being dragged; `id: null` is a component fresh from the palette. */
export interface DragSession extends ActiveDrag {
  readonly label: string;
}

export type { IndicatorRect };

export interface DragState {
  readonly session: DragSession | null;
  readonly target: DropTarget | null;
  readonly indicator: IndicatorRect | null;
  readonly isKeyboard: boolean;
}

/** The slice of a keyboard event the controller needs; React's and the DOM's both fit. */
export interface KeyEventLike {
  readonly key: string;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface CanvasDragControllerOptions {
  getContainer(): HTMLElement | null;
  getChildren(): readonly PageNode[];
  isEnabled(): boolean;
  catalog: ComponentCatalog;
  /** Display name of a component type, for the drag preview and announcements. */
  labelOf: (type: string) => string;
  onDrop(session: DragSession, target: DropTarget): void;
}

/** Keyboard steps through drop targets in render order. */
const ARROW_DIRECTIONS: Readonly<Partial<Record<string, -1 | 1>>> = { ArrowUp: -1, ArrowDown: 1 };

export interface CanvasDragController {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => DragState;
  /** Wires pointer dragging of canvas nodes; returns the detach function. */
  readonly attach: (container: HTMLElement) => () => void;
  readonly beginPaletteDrag: (componentType: string) => void;
  readonly movePointer: (clientX: number, clientY: number) => void;
  readonly drop: () => void;
  readonly cancel: () => void;
  readonly handleGripKey: (nodeId: PageNodeId, event: KeyEventLike) => void;
}

const IDLE: DragState = {
  session: null,
  target: null,
  indicator: null,
  isKeyboard: false,
};

/**
 * Drag and drop on the REAL rendered markup: nodes are found through
 * `data-civo-node-id`, never wrapped, because the canvas content is opaque
 * server-rendered output. All placement decisions come from the domain's
 * pure functions; this file only measures, tracks the pointer and keeps
 * the state the view renders. No React, so it runs against a fake DOM.
 */
export function createCanvasDragController(
  options: CanvasDragControllerOptions,
): CanvasDragController {
  let state = IDLE;
  let rects = new Map<PageNodeId, Rect>();
  const listeners = new Set<() => void>();

  function setState(next: DragState): void {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  }

  function labelOf(type: string): string {
    return options.labelOf(type);
  }

  function indicatorFor(target: DropTarget | null): IndicatorRect | null {
    const container = options.getContainer();
    return indicatorRectFor({
      target,
      rects,
      containerSize:
        container === null
          ? null
          : { width: container.clientWidth, height: container.clientHeight },
    });
  }

  function setTarget(target: DropTarget | null): void {
    if (state.session === null || deepEqual(target, state.target)) {
      return;
    }
    setState({ ...state, target, indicator: indicatorFor(target) });
  }

  function begin(session: DragSession, isKeyboard: boolean): void {
    if (!options.isEnabled()) {
      return;
    }
    const container = options.getContainer();
    rects = container === null ? new Map<PageNodeId, Rect>() : measureAllNodeRects(container);
    setState({ session, target: null, indicator: null, isKeyboard });
  }

  function computeTarget(
    session: DragSession,
    clientX: number,
    clientY: number,
  ): DropTarget | null {
    const container = options.getContainer();
    const element = document.elementFromPoint(clientX, clientY);
    // The whole canvas frame counts as "over the canvas", so whitespace below the last node still drops.
    if (container === null || element === null || !container.parentElement?.contains(element)) {
      return null;
    }
    const children = options.getChildren();
    const active = { id: session.id, type: session.type };
    const nodeId = findNodeId(element);
    if (nodeId === null) {
      return resolveDropTargetAtCanvasEnd({ tree: children, active, policy: options.catalog });
    }

    const rect = rects.get(nodeId);
    if (rect === undefined) {
      return null;
    }
    // Rects are container-relative, so the pointer must be too.
    const pointerY = clientY - container.getBoundingClientRect().top;
    return resolveDropTargetForNode(
      { tree: children, active, policy: options.catalog },
      { targetId: nodeId, pointerY, targetRect: rect },
    );
  }

  function movePointer(clientX: number, clientY: number): void {
    if (state.session === null || state.isKeyboard) {
      return;
    }
    setTarget(computeTarget(state.session, clientX, clientY));
  }

  function cancel(): void {
    setState(IDLE);
  }

  function drop(): void {
    const { session, target } = state;
    setState(IDLE);
    if (session !== null && target !== null) {
      options.onDrop(session, target);
    }
  }

  function beginNodeDrag(nodeId: PageNodeId, isKeyboard: boolean): void {
    const node = findNode(options.getChildren(), nodeId);
    if (node !== null) {
      begin({ id: nodeId, type: node.type, label: labelOf(node.type) }, isKeyboard);
    }
  }

  function stepKeyboardTarget(session: DragSession, nodeId: PageNodeId, direction: -1 | 1): void {
    const current = state.target;
    const next = stepDropTarget(
      {
        tree: options.getChildren(),
        active: { id: session.id, type: session.type },
        policy: options.catalog,
      },
      current === null || current.kind === 'root' ? nodeId : current.targetNodeId,
      direction,
    );
    if (next !== null) {
      setTarget(next);
    }
  }

  /** Space or Enter picks the node up, then drops it; arrows move the target; Escape cancels. */
  function handleGripKey(nodeId: PageNodeId, event: KeyEventLike): void {
    const isPickupKey = event.key === ' ' || event.key === 'Enter';
    if (!state.isKeyboard) {
      if (isPickupKey) {
        event.preventDefault();
        beginNodeDrag(nodeId, true);
      }
      return;
    }
    const { session } = state;
    if (session?.id !== nodeId) {
      return;
    }

    if (isPickupKey) {
      event.preventDefault();
      drop();
      return;
    }
    if (event.key === 'Escape') {
      // Stopped here so the window-level Escape (deselect) does not also fire.
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    const direction = ARROW_DIRECTIONS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      stepKeyboardTarget(session, nodeId, direction);
    }
  }

  function attach(container: HTMLElement): () => void {
    let pending: {
      readonly x: number;
      readonly y: number;
      readonly id: PageNodeId;
    } | null = null;

    function handlePointerDown(event: PointerEvent): void {
      const id = findNodeId(event.target);
      pending =
        options.isEnabled() && event.button === 0 && id !== null
          ? { x: event.clientX, y: event.clientY, id }
          : null;
    }

    function handlePointerMove(event: PointerEvent): void {
      if (pending === null) {
        return;
      }
      if (state.session === null) {
        const current = { x: event.clientX, y: event.clientY };
        if (!hasExceededActivationDistance(pending, current)) {
          return;
        }
        beginNodeDrag(pending.id, false);
      }
      movePointer(event.clientX, event.clientY);
    }

    function handlePointerUp(): void {
      const wasDragging = pending !== null && state.session !== null;
      pending = null;
      if (wasDragging) {
        drop();
      }
    }

    function handlePointerCancel(): void {
      const wasDragging = pending !== null && state.session !== null;
      pending = null;
      if (wasDragging) {
        cancel();
      }
    }

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    attach,
    beginPaletteDrag: (componentType) => {
      begin({ id: null, type: componentType, label: labelOf(componentType) }, false);
    },
    movePointer,
    drop,
    cancel,
    handleGripKey,
  };
}
