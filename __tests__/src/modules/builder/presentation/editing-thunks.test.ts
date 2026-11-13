import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createComponentCatalog } from '@modules/builder/application/contracts/editor-model';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import { parsePageNodeId } from '@modules/builder/domain/models/ids';
import type { EditorSessionDto } from '@modules/builder/presentation/dto/editor-session-dto';
import { createBuilderStore } from '@modules/builder/presentation/state/builder-store';
import type { BuilderStore } from '@modules/builder/presentation/state/builder-store';
import {
  applyDrop,
  duplicateNodeById,
  insertComponent,
  moveNodeBy,
  removeNodeById,
  removeSelectedNode,
} from '@modules/builder/presentation/state/editing-thunks';

/** The node at an index of a list the test knows is long enough; a short list is the failure. */
function nodeAt<T>(nodes: readonly T[], index: number): T {
  const node = nodes[index];
  if (node === undefined) {
    throw new Error(`the page has no node at ${String(index)}`);
  }
  return node;
}

const containerDescriptor: ComponentDescriptor = {
  type: 'container',
  category: 'layout',
  labelKey: 'comp.container',
  descriptionKey: 'comp.container.desc',
  sampleKey: 'comp.container.sample',
  isAllowedAtRoot: true,
  acceptsChildren: true,
  allowedChildTypes: ['button', 'leaf', 'container'],
  municipalPropKeys: ['title'],
  isSingleton: false,
  fields: [],
  blueprint: {
    type: 'container',
    props: {},
    children: [],
  },
};

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
    props: { label: 'Click me' },
    children: [],
  },
};

const leafDescriptor: ComponentDescriptor = {
  type: 'leaf',
  category: 'content',
  labelKey: 'comp.leaf',
  descriptionKey: 'comp.leaf.desc',
  sampleKey: 'comp.leaf.sample',
  isAllowedAtRoot: false,
  acceptsChildren: false,
  allowedChildTypes: [],
  municipalPropKeys: [],
  isSingleton: false,
  fields: [],
  blueprint: {
    type: 'leaf',
    props: {},
    children: [],
  },
};

const descriptors = [containerDescriptor, buttonDescriptor, leafDescriptor];
const catalog = createComponentCatalog(descriptors);

describe('editing-thunks', () => {
  let store: BuilderStore;
  let seedCounter = 100;

  function makeSession(initialChildren: any[] = []): EditorSessionDto {
    return {
      canRestructure: true,
      components: descriptors,
      page: {
        id: 'page1',
        websiteId: 'web1',
        path: '/test',
        title: 'Test Page',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        config: {
          type: 'page',
          children: initialChildren,
        },
      },
    };
  }

  function setupStore(initialChildren: any[] = []) {
    seedCounter = 100;
    return createBuilderStore(makeSession(initialChildren), {
      catalog,
      savePageConfig: vi.fn(),
      createIdSeed: () => `seed${seedCounter++}`,
    });
  }

  beforeEach(() => {
    store = setupStore();
  });

  describe('insertComponent', () => {
    it('inserts a root-allowed component at the page root', () => {
      store.dispatch(insertComponent('button'));
      const state = store.getState().document.history.present;
      expect(state.children).toHaveLength(1);
      expect(nodeAt(state.children, 0).type).toBe('button');
      expect(state.selectedNodeId).toBe(nodeAt(state.children, 0).id);
    });

    it('rejects an un-nestable component when not allowed at root and no container is selected', () => {
      store.dispatch(insertComponent('leaf'));
      const state = store.getState().document.history.present;
      expect(state.children).toHaveLength(0);
      expect(store.getState().ui.noticeCode).not.toBeNull();
    });

    it('inserts a child inside a selected container that allows it', () => {
      store.dispatch(insertComponent('container'));

      store.dispatch(insertComponent('leaf'));
      const state = store.getState().document.history.present;
      expect(state.children).toHaveLength(1);
      expect(nodeAt(state.children, 0).children).toHaveLength(1);
      expect(nodeAt(state.children, 0).children[0]?.type).toBe('leaf');
    });
  });

  describe('removeNodeById & removeSelectedNode', () => {
    it('removes a node by id and selects the next sibling or parent', () => {
      store.dispatch(insertComponent('button'));
      store.dispatch(insertComponent('button'));
      const stateBefore = store.getState().document.history.present;
      expect(stateBefore.children).toHaveLength(2);
      const firstId = nodeAt(stateBefore.children, 0).id;

      store.dispatch(removeNodeById(firstId));
      const stateAfter = store.getState().document.history.present;
      expect(stateAfter.children).toHaveLength(1);
      expect(nodeAt(stateAfter.children, 0).id).not.toBe(firstId);
    });

    it('removes currently selected node when removeSelectedNode is dispatched', () => {
      store.dispatch(insertComponent('button'));
      expect(store.getState().document.history.present.children).toHaveLength(1);

      store.dispatch(removeSelectedNode());
      expect(store.getState().document.history.present.children).toHaveLength(0);
    });

    it('does nothing on removeSelectedNode when nothing is selected', () => {
      store = setupStore([
        { id: parsePageNodeId('node1'), type: 'button', props: {}, children: [] },
      ]);
      expect(store.getState().document.history.present.selectedNodeId).toBeNull();
      store.dispatch(removeSelectedNode());
      expect(store.getState().document.history.present.children).toHaveLength(1);
    });
  });

  describe('duplicateNodeById', () => {
    it('duplicates the specified node', () => {
      store.dispatch(insertComponent('button'));
      const originalNode = nodeAt(store.getState().document.history.present.children, 0);

      store.dispatch(duplicateNodeById(originalNode.id));
      const state = store.getState().document.history.present;
      expect(state.children).toHaveLength(2);
      expect(state.selectedNodeId).toBe(nodeAt(state.children, 1).id);
      expect(nodeAt(state.children, 1).id).not.toBe(originalNode.id);
    });
  });

  describe('moveNodeBy', () => {
    it('moves node down among siblings', () => {
      store.dispatch(insertComponent('container'));
      store.dispatch(insertComponent('button'));
      const stateBefore = store.getState().document.history.present;
      const firstId = nodeAt(stateBefore.children, 0).id;
      const secondId = nodeAt(stateBefore.children, 1).id;

      store.dispatch(moveNodeBy(firstId, 1));
      const stateAfter = store.getState().document.history.present;
      expect(nodeAt(stateAfter.children, 0).id).toBe(secondId);
      expect(nodeAt(stateAfter.children, 1).id).toBe(firstId);
    });

    it('does nothing when moving past boundary', () => {
      store.dispatch(insertComponent('button'));
      const id = nodeAt(store.getState().document.history.present.children, 0).id;
      store.dispatch(moveNodeBy(id, -1)); // cannot move up past top
      expect(nodeAt(store.getState().document.history.present.children, 0).id).toBe(id);
    });
  });

  describe('applyDrop', () => {
    it('moves an existing node to target placement', () => {
      store.dispatch(insertComponent('button'));
      store.dispatch(insertComponent('container'));
      const stateBefore = store.getState().document.history.present;
      const btnId = nodeAt(stateBefore.children, 0).id;
      const contId = nodeAt(stateBefore.children, 1).id;

      // Drop button after container
      store.dispatch(
        applyDrop(
          { id: btnId, type: 'button' },
          { kind: 'relative', parentId: null, targetNodeId: contId, position: 'after' },
        ),
      );

      const stateAfter = store.getState().document.history.present;
      expect(nodeAt(stateAfter.children, 0).id).toBe(contId);
      expect(nodeAt(stateAfter.children, 1).id).toBe(btnId);
    });

    it('inserts a new component from palette onto target placement', () => {
      store.dispatch(insertComponent('container'));
      const contId = nodeAt(store.getState().document.history.present.children, 0).id;

      store.dispatch(
        applyDrop(
          { id: null, type: 'button' },
          { kind: 'relative', parentId: null, targetNodeId: contId, position: 'before' },
        ),
      );

      const state = store.getState().document.history.present;
      expect(state.children).toHaveLength(2);
      expect(nodeAt(state.children, 0).type).toBe('button');
      expect(nodeAt(state.children, 1).id).toBe(contId);
    });
  });
});
