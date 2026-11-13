import { describe, expect, it } from 'vitest';

import type {
  ComponentCatalog,
  NestingPolicy,
} from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import { toPageNodeId } from '@modules/builder/domain/models/ids';
import type { PageNode } from '@modules/builder/domain/models/page-node';
import {
  createNodeFromBlueprint,
  duplicateNode,
  insertNewComponent,
  insertNode,
  moveNode,
  nextSelectionAfterRemoval,
  removeNode,
  stepPlacement,
  updateNodeProps,
} from '@modules/builder/domain/tree/tree-operations';

const mockPolicy: NestingPolicy = {
  acceptsChildren: (type: string) => type === 'container' || type === 'columns',
  canNest: (parentType: string | null, childType: string) => {
    if (parentType === null) {
      return childType !== 'only-child';
    }
    if (parentType === 'container') {
      return childType !== 'container';
    }
    return true;
  },
};

const textDescriptor: ComponentDescriptor = {
  type: 'text',
  category: 'content',
  isSingleton: false,
  blueprint: {
    type: 'text',
    props: { content: 'Default text' },
    children: [],
  },
} as unknown as ComponentDescriptor;

const singletonDescriptor: ComponentDescriptor = {
  type: 'hero',
  category: 'content',
  isSingleton: true,
  blueprint: {
    type: 'hero',
    props: { title: 'Main Hero' },
    children: [],
  },
} as unknown as ComponentDescriptor;

const mockCatalog: ComponentCatalog = {
  describe: (type: string) => {
    if (type === 'text') {
      return textDescriptor;
    }
    if (type === 'hero') {
      return singletonDescriptor;
    }
    return null;
  },
  canNest: mockPolicy.canNest,
  acceptsChildren: mockPolicy.acceptsChildren,
} as unknown as ComponentCatalog;

describe('tree-operations domain logic', () => {
  const nodeA: PageNode = {
    id: toPageNodeId('node-a'),
    type: 'text',
    props: { text: 'Hello' },
    children: [],
  };

  const containerA: PageNode = {
    id: toPageNodeId('container-a'),
    type: 'container',
    props: {},
    children: [
      {
        id: toPageNodeId('child-1'),
        type: 'text',
        props: { text: 'Child 1' },
        children: [],
      },
      {
        id: toPageNodeId('child-2'),
        type: 'text',
        props: { text: 'Child 2' },
        children: [],
      },
    ],
  };

  describe('createNodeFromBlueprint', () => {
    it('generates deterministic IDs from valid seed', () => {
      const blueprint = {
        type: 'container',
        props: {},
        children: [
          { type: 'text', props: { text: 'T1' }, children: [] },
          { type: 'text', props: { text: 'T2' }, children: [] },
        ],
      };

      const result = createNodeFromBlueprint(blueprint, 'seed123');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe('container');
        expect(result.value.children).toHaveLength(2);
        expect(result.value.children[0]?.id).not.toBe(result.value.children[1]?.id);
      }
    });

    it('rejects invalid seed', () => {
      const result = createNodeFromBlueprint(textDescriptor.blueprint, '');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('insertNode', () => {
    it('inserts a node at root level', () => {
      const tree = [nodeA];
      const newNode: PageNode = {
        id: toPageNodeId('node-b'),
        type: 'text',
        props: {},
        children: [],
      };

      const result = insertNode(
        tree,
        { node: newNode, placement: { parentId: null, index: 1 } },
        mockPolicy,
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[1]?.id).toBe(newNode.id);
      }
    });

    it('inserts inside a parent container', () => {
      const tree = [containerA];
      const newNode: PageNode = {
        id: toPageNodeId('child-3'),
        type: 'text',
        props: {},
        children: [],
      };

      const result = insertNode(
        tree,
        { node: newNode, placement: { parentId: containerA.id, index: 1 } },
        mockPolicy,
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0]?.children).toHaveLength(3);
        expect(result.value[0]?.children[1]?.id).toBe(newNode.id);
      }
    });

    it('rejects insertion if ID already exists', () => {
      const tree = [nodeA];
      const result = insertNode(
        tree,
        { node: nodeA, placement: { parentId: null, index: 0 } },
        mockPolicy,
      );
      expect(result.isErr()).toBe(true);
    });

    it('rejects insertion if parent does not exist', () => {
      const tree = [nodeA];
      const newNode: PageNode = {
        id: toPageNodeId('node-b'),
        type: 'text',
        props: {},
        children: [],
      };
      const result = insertNode(
        tree,
        { node: newNode, placement: { parentId: toPageNodeId('missing-parent'), index: 0 } },
        mockPolicy,
      );
      expect(result.isErr()).toBe(true);
    });

    it('rejects insertion if nesting is disallowed', () => {
      const tree = [containerA];
      const nestedContainer: PageNode = {
        id: toPageNodeId('c-2'),
        type: 'container',
        props: {},
        children: [],
      };
      // mockPolicy says container cannot nest container
      const result = insertNode(
        tree,
        { node: nestedContainer, placement: { parentId: containerA.id, index: 0 } },
        mockPolicy,
      );
      expect(result.isErr()).toBe(true);
    });
  });

  describe('insertNewComponent', () => {
    it('creates and inserts a valid component from catalog', () => {
      const tree = [nodeA];
      const result = insertNewComponent({
        nodes: tree,
        catalog: mockCatalog,
        componentType: 'text',
        placement: { parentId: null, index: 1 },
        idSeed: 'testseed1',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.tree).toHaveLength(2);
        expect(result.value.newNodeId).toBeDefined();
      }
    });

    it('rejects unknown component type', () => {
      const result = insertNewComponent({
        nodes: [],
        catalog: mockCatalog,
        componentType: 'non-existent',
        placement: { parentId: null, index: 0 },
        idSeed: 'testseed1',
      });
      expect(result.isErr()).toBe(true);
    });

    it('rejects adding duplicate singleton component', () => {
      const heroNode: PageNode = {
        id: toPageNodeId('hero-1'),
        type: 'hero',
        props: {},
        children: [],
      };
      const result = insertNewComponent({
        nodes: [heroNode],
        catalog: mockCatalog,
        componentType: 'hero',
        placement: { parentId: null, index: 1 },
        idSeed: 'test-seed-2',
      });
      expect(result.isErr()).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('removes a node and preserves other nodes', () => {
      const tree = [nodeA, containerA];
      const result = removeNode(tree, nodeA.id);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([containerA]);
      }
    });

    it('removes a nested child node', () => {
      const tree = [containerA];
      const result = removeNode(tree, toPageNodeId('child-1'));
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0]?.children).toHaveLength(1);
        expect(result.value[0]?.children[0]?.id).toBe('child-2');
      }
    });

    it('returns not found error if node does not exist', () => {
      const result = removeNode([nodeA], toPageNodeId('missing'));
      expect(result.isErr()).toBe(true);
    });
  });

  describe('updateNodeProps', () => {
    it('applies props patch and deletes undefined properties', () => {
      const nodeWithProps: PageNode = {
        id: toPageNodeId('n1'),
        type: 'text',
        props: { a: 'first', b: 'second', c: 'third' },
        children: [],
      };
      const tree = [nodeWithProps];

      const result = updateNodeProps(tree, nodeWithProps.id, {
        b: 'updated',
        c: undefined,
        d: 'new',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0]?.props).toEqual({
          a: 'first',
          b: 'updated',
          d: 'new',
        });
      }
    });

    it('returns not found error if target node does not exist', () => {
      const result = updateNodeProps([nodeA], toPageNodeId('missing'), { a: 1 });
      expect(result.isErr()).toBe(true);
    });
  });

  describe('stepPlacement', () => {
    it('calculates step placement within siblings', () => {
      const tree = [containerA];
      const stepForward = stepPlacement(tree, toPageNodeId('child-1'), 1);
      expect(stepForward).toEqual({ parentId: containerA.id, index: 1 });

      const stepBackward = stepPlacement(tree, toPageNodeId('child-2'), -1);
      expect(stepBackward).toEqual({ parentId: containerA.id, index: 0 });
    });

    it('returns null when stepping beyond siblings boundaries', () => {
      const tree = [containerA];
      expect(stepPlacement(tree, toPageNodeId('child-1'), -1)).toBeNull();
      expect(stepPlacement(tree, toPageNodeId('child-2'), 1)).toBeNull();
      expect(stepPlacement(tree, toPageNodeId('missing'), 1)).toBeNull();
    });
  });

  describe('moveNode', () => {
    it('moves a node to another position or parent', () => {
      const tree = [nodeA, containerA];
      const result = moveNode(
        tree,
        { nodeId: nodeA.id, placement: { parentId: containerA.id, index: 0 } },
        mockPolicy,
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.children).toHaveLength(3);
        expect(result.value[0]?.children[0]?.id).toBe(nodeA.id);
      }
    });

    it('prevents cycle (moving a parent into its own child/subtree)', () => {
      const tree = [containerA];
      const result = moveNode(
        tree,
        { nodeId: containerA.id, placement: { parentId: toPageNodeId('child-1'), index: 0 } },
        mockPolicy,
      );
      expect(result.isErr()).toBe(true);
    });

    it('rejects move if node or parent does not exist', () => {
      expect(
        moveNode(
          [nodeA],
          { nodeId: toPageNodeId('missing'), placement: { parentId: null, index: 0 } },
          mockPolicy,
        ).isErr(),
      ).toBe(true);
      expect(
        moveNode(
          [nodeA],
          { nodeId: nodeA.id, placement: { parentId: toPageNodeId('missing-p'), index: 0 } },
          mockPolicy,
        ).isErr(),
      ).toBe(true);
    });
  });

  describe('duplicateNode', () => {
    it('duplicates a node right after the original with fresh IDs', () => {
      const tree = [nodeA];
      const result = duplicateNode(tree, nodeA.id, 'seeddup1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.tree).toHaveLength(2);
        expect(result.value.newNodeId).not.toBe(nodeA.id);
        expect(result.value.tree[1]?.id).toBe(result.value.newNodeId);
        expect(result.value.tree[1]?.props).toEqual(nodeA.props);
      }
    });

    it('rejects duplicate if seed creates ID collision', () => {
      // Create first duplicate
      const dup1 = duplicateNode([nodeA], nodeA.id, 'seeddup2')._unsafeUnwrap();
      // Duplicating again with same seed will collide with the first clone's ID
      const dup2 = duplicateNode(dup1.tree, nodeA.id, 'seeddup2');
      expect(dup2.isErr()).toBe(true);
    });
  });

  describe('nextSelectionAfterRemoval', () => {
    it('keeps selection if removed node is not the selected one', () => {
      const sel = nextSelectionAfterRemoval([nodeA, containerA], nodeA.id, containerA.id);
      expect(sel).toBe(containerA.id);
    });

    it('selects next sibling when available', () => {
      const n1 = { ...nodeA, id: toPageNodeId('n1') };
      const n2 = { ...nodeA, id: toPageNodeId('n2') };
      const sel = nextSelectionAfterRemoval([n1, n2], n1.id, n1.id);
      expect(sel).toBe(n2.id);
    });

    it('selects previous sibling when last sibling is removed', () => {
      const n1 = { ...nodeA, id: toPageNodeId('n1') };
      const n2 = { ...nodeA, id: toPageNodeId('n2') };
      const sel = nextSelectionAfterRemoval([n1, n2], n2.id, n2.id);
      expect(sel).toBe(n1.id);
    });

    it('selects parent when only child is removed', () => {
      const singleChildContainer: PageNode = {
        id: toPageNodeId('c-single'),
        type: 'container',
        props: {},
        children: [{ id: toPageNodeId('c-only'), type: 'text', props: {}, children: [] }],
      };
      const sel = nextSelectionAfterRemoval(
        [singleChildContainer],
        toPageNodeId('c-only'),
        toPageNodeId('c-only'),
      );
      expect(sel).toBe(singleChildContainer.id);
    });

    it('returns null when node not found or tree empty', () => {
      expect(nextSelectionAfterRemoval([], toPageNodeId('m'), toPageNodeId('m'))).toBeNull();
    });
  });
});
