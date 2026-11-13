import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createComponentCatalog } from '@modules/builder/application/contracts/editor-model';
import type { PageNode } from '@modules/builder/application/contracts/editor-model';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import { toPageNodeId } from '@modules/builder/domain/models/ids';
import type { DropTarget } from '@modules/builder/domain/tree/drop-placement';
import { createCanvasDragController } from '@modules/builder/presentation/dnd/canvas-drag-controller';
import type { DragSession } from '@modules/builder/presentation/dnd/canvas-drag-controller';

import type { Mock } from 'vitest';

const buttonDescriptor: ComponentDescriptor = {
  type: 'button',
  category: 'content',
  labelKey: 'comp.button',
  descriptionKey: 'comp.button.desc',
  sampleKey: 'comp.button.sample',
  isAllowedAtRoot: true,
  acceptsChildren: false,
  allowedChildTypes: [],
  municipalPropKeys: ['label'],
  isSingleton: false,
  fields: [],
  blueprint: {
    type: 'button',
    props: { label: 'Click' },
    children: [],
  },
};

const containerDescriptor: ComponentDescriptor = {
  type: 'container',
  category: 'layout',
  labelKey: 'comp.container',
  descriptionKey: 'comp.container.desc',
  sampleKey: 'comp.container.sample',
  isAllowedAtRoot: true,
  acceptsChildren: true,
  allowedChildTypes: ['button'],
  municipalPropKeys: [],
  isSingleton: false,
  fields: [],
  blueprint: {
    type: 'container',
    props: {},
    children: [],
  },
};

const catalog = createComponentCatalog([buttonDescriptor, containerDescriptor]);

describe('createCanvasDragController', () => {
  let parentContainer: HTMLElement;
  let canvasContainer: HTMLElement;
  let nodeElement1: HTMLElement;
  let nodeElement2: HTMLElement;
  let nodes: PageNode[];
  let onDropMock: Mock<(session: DragSession, target: DropTarget) => void>;
  let isEnabled = true;

  const node1Id = toPageNodeId('node1');
  const node2Id = toPageNodeId('node2');

  beforeEach(() => {
    isEnabled = true;
    onDropMock = vi.fn<(session: DragSession, target: DropTarget) => void>();

    parentContainer = document.createElement('div');
    canvasContainer = document.createElement('div');
    parentContainer.appendChild(canvasContainer);
    document.body.appendChild(parentContainer);

    nodeElement1 = document.createElement('div');
    nodeElement1.setAttribute('data-civo-node-id', 'node1');
    nodeElement2 = document.createElement('div');
    nodeElement2.setAttribute('data-civo-node-id', 'node2');

    canvasContainer.appendChild(nodeElement1);
    canvasContainer.appendChild(nodeElement2);

    nodes = [
      { id: node1Id, type: 'button', props: {}, children: [] },
      { id: node2Id, type: 'container', props: {}, children: [] },
    ];

    // Mock getBoundingClientRect
    vi.spyOn(canvasContainer, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 100,
      bottom: 500,
      right: 500,
      width: 400,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    vi.spyOn(nodeElement1, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 100,
      bottom: 200,
      right: 500,
      width: 400,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    vi.spyOn(nodeElement2, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      left: 100,
      bottom: 400,
      right: 500,
      width: 400,
      height: 200,
      x: 100,
      y: 200,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createController() {
    return createCanvasDragController({
      getContainer: () => canvasContainer,
      getChildren: () => nodes,
      isEnabled: () => isEnabled,
      catalog,
      labelOf: (type) => `Label:${type}`,
      onDrop: onDropMock,
    });
  }

  it('initializes with idle state and notifies subscribers on state changes', () => {
    const controller = createController();
    expect(controller.getSnapshot()).toEqual({
      session: null,
      target: null,
      indicator: null,
      isKeyboard: false,
    });

    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.beginPaletteDrag('button');
    expect(listener).toHaveBeenCalled();
    expect(controller.getSnapshot().session).toEqual({
      id: null,
      type: 'button',
      label: 'Label:button',
    });

    unsubscribe();
    controller.cancel();
    expect(controller.getSnapshot().session).toBeNull();
  });

  it('does not begin drag if isEnabled returns false', () => {
    isEnabled = false;
    const controller = createController();
    controller.beginPaletteDrag('button');
    expect(controller.getSnapshot().session).toBeNull();
  });

  it('tracks pointer move and resolves target over nodes', () => {
    const controller = createController();
    controller.beginPaletteDrag('button');

    // Mock document.elementFromPoint
    vi.spyOn(document, 'elementFromPoint').mockImplementation((_x, y) => {
      if (y >= 100 && y < 200) {
        return nodeElement1;
      }
      if (y >= 200 && y < 400) {
        return nodeElement2;
      }
      return canvasContainer;
    });

    // Move pointer over top half of node1
    controller.movePointer(150, 120);
    const snap1 = controller.getSnapshot();
    expect(snap1.target).not.toBeNull();
    expect(snap1.target?.kind).toBe('relative');

    // Move pointer over whitespace within canvas
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(canvasContainer);
    controller.movePointer(150, 450);
    const snapEnd = controller.getSnapshot();
    expect(snapEnd.target).not.toBeNull();

    // Drop fires onDrop callback
    controller.drop();
    expect(onDropMock).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().session).toBeNull();
  });

  it('cancels drag cleanly without firing onDrop', () => {
    const controller = createController();
    controller.beginPaletteDrag('button');
    controller.cancel();
    expect(controller.getSnapshot().session).toBeNull();
    expect(onDropMock).not.toHaveBeenCalled();
  });

  describe('keyboard drag grip handling', () => {
    it('handles Space or Enter to pick up node, arrows to step target, and Enter to drop', () => {
      const controller = createController();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      // Pickup node 1 with Enter
      controller.handleGripKey(node1Id, {
        key: 'Enter',
        preventDefault,
        stopPropagation,
      });

      expect(preventDefault).toHaveBeenCalled();
      const snap = controller.getSnapshot();
      expect(snap.isKeyboard).toBe(true);
      expect(snap.session?.id).toBe(node1Id);

      // ArrowDown steps target
      controller.handleGripKey(node1Id, {
        key: 'ArrowDown',
        preventDefault,
        stopPropagation,
      });
      expect(controller.getSnapshot().target).not.toBeNull();

      // Enter drops
      controller.handleGripKey(node1Id, {
        key: 'Enter',
        preventDefault,
        stopPropagation,
      });
      expect(onDropMock).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot().session).toBeNull();
    });

    it('cancels keyboard drag on Escape', () => {
      const controller = createController();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      controller.handleGripKey(node1Id, {
        key: ' ',
        preventDefault,
        stopPropagation,
      });
      expect(controller.getSnapshot().isKeyboard).toBe(true);

      controller.handleGripKey(node1Id, {
        key: 'Escape',
        preventDefault,
        stopPropagation,
      });
      expect(stopPropagation).toHaveBeenCalled();
      expect(controller.getSnapshot().session).toBeNull();
    });

    it('ignores keys for a node that is not the currently dragged session', () => {
      const controller = createController();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      controller.handleGripKey(node1Id, {
        key: 'Enter',
        preventDefault,
        stopPropagation,
      });

      // Send key for node2
      controller.handleGripKey(node2Id, {
        key: 'ArrowDown',
        preventDefault,
        stopPropagation,
      });
      // Should remain targeting node1's session
      expect(controller.getSnapshot().session?.id).toBe(node1Id);
    });
  });

  describe('DOM pointer event attachment', () => {
    it('attaches and detaches pointer listeners', () => {
      const controller = createController();
      const detach = controller.attach(canvasContainer);

      // Pointer down on node1
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 150,
        button: 0,
        bubbles: true,
      });
      Object.defineProperty(downEvent, 'target', { value: nodeElement1 });
      canvasContainer.dispatchEvent(downEvent);

      // Pointer move exceeding activation threshold (e.g., > 4px)
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 180,
        clientY: 180,
        bubbles: true,
      });
      window.dispatchEvent(moveEvent);

      expect(controller.getSnapshot().session?.id).toBe(node1Id);

      // Pointer up drops
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      window.dispatchEvent(upEvent);

      expect(controller.getSnapshot().session).toBeNull();

      detach();
    });

    it('cancels drag on pointercancel', () => {
      const controller = createController();
      const detach = controller.attach(canvasContainer);

      const downEvent = new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 150,
        button: 0,
        bubbles: true,
      });
      Object.defineProperty(downEvent, 'target', { value: nodeElement1 });
      canvasContainer.dispatchEvent(downEvent);

      const moveEvent = new PointerEvent('pointermove', {
        clientX: 180,
        clientY: 180,
        bubbles: true,
      });
      window.dispatchEvent(moveEvent);
      expect(controller.getSnapshot().session?.id).toBe(node1Id);

      window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
      expect(controller.getSnapshot().session).toBeNull();
      expect(onDropMock).not.toHaveBeenCalled();

      detach();
    });
  });
});
