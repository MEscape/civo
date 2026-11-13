import { describe, expect, it } from 'vitest';

import type { NestingPolicy } from '@modules/builder/domain/models/component-catalog';
import { toPageNodeId } from '@modules/builder/domain/models/ids';
import type { PageNode } from '@modules/builder/domain/models/page-node';
import {
  resolveDropPosition,
  resolveDropTargetForNode,
  resolveDropTargetAtCanvasEnd,
  stepDropTarget,
  resolvePlacement,
} from '@modules/builder/domain/tree/drop-placement';
import type { DropContext } from '@modules/builder/domain/tree/drop-placement';

const mockPolicy: NestingPolicy = {
  acceptsChildren: (type: string) => type === 'container' || type === 'section',
  canNest: (parentType: string | null, childType: string) => {
    if (parentType === null) {
      return childType !== 'restricted';
    }
    if (parentType === 'container') {
      return childType !== 'section';
    }
    if (parentType === 'section') {
      return true;
    }
    return false;
  },
};

const leafNode1: PageNode = {
  id: toPageNodeId('node-1'),
  type: 'text',
  props: {},
  children: [],
};

const emptyContainer: PageNode = {
  id: toPageNodeId('container-1'),
  type: 'container',
  props: {},
  children: [],
};

const populatedContainer: PageNode = {
  id: toPageNodeId('container-2'),
  type: 'container',
  props: {},
  children: [
    {
      id: toPageNodeId('child-1'),
      type: 'text',
      props: {},
      children: [],
    },
    {
      id: toPageNodeId('child-2'),
      type: 'text',
      props: {},
      children: [],
    },
  ],
};

describe('drop-placement domain logic', () => {
  describe('resolveDropPosition', () => {
    it('returns inside for empty container that accepts children', () => {
      const pos = resolveDropPosition(
        100,
        { top: 0, left: 0, width: 200, height: 200 },
        {
          acceptsChildren: true,
          isEmpty: true,
        },
      );
      expect(pos).toBe('inside');
    });

    it('returns before/inside/after for non-empty container based on edge bands', () => {
      const rect = { top: 100, left: 0, width: 200, height: 100 };
      // Top 30%: pointerY between 100 and 130 (< 130) -> before
      expect(resolveDropPosition(110, rect, { acceptsChildren: true, isEmpty: false })).toBe(
        'before',
      );
      // Bottom 30%: pointerY > 170 -> after
      expect(resolveDropPosition(180, rect, { acceptsChildren: true, isEmpty: false })).toBe(
        'after',
      );
      // Middle: between 130 and 170 -> inside
      expect(resolveDropPosition(150, rect, { acceptsChildren: true, isEmpty: false })).toBe(
        'inside',
      );
    });

    it('returns before/after for leaf node based on midpoint', () => {
      const rect = { top: 100, left: 0, width: 200, height: 100 };
      // Top 30% -> before
      expect(resolveDropPosition(120, rect, { acceptsChildren: false, isEmpty: true })).toBe(
        'before',
      );
      // Between 30% and 50% -> before
      expect(resolveDropPosition(140, rect, { acceptsChildren: false, isEmpty: true })).toBe(
        'before',
      );
      // Between 50% and 70% -> after
      expect(resolveDropPosition(160, rect, { acceptsChildren: false, isEmpty: true })).toBe(
        'after',
      );
      // Bottom 30% -> after
      expect(resolveDropPosition(190, rect, { acceptsChildren: false, isEmpty: true })).toBe(
        'after',
      );
    });

    it('handles zero height rect fallback', () => {
      const rect = { top: 100, left: 0, width: 200, height: 0 };
      expect(resolveDropPosition(100, rect, { acceptsChildren: false, isEmpty: true })).toBe(
        'after',
      );
    });
  });

  describe('resolveDropTargetForNode', () => {
    const context: DropContext = {
      tree: [leafNode1, emptyContainer, populatedContainer],
      active: { id: null, type: 'button' },
      policy: mockPolicy,
    };

    it('returns null if target node is not found', () => {
      const res = resolveDropTargetForNode(context, {
        targetId: toPageNodeId('non-existent'),
        pointerY: 50,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(res).toBeNull();
    });

    it('returns null when dropping onto own subtree', () => {
      const selfContext: DropContext = {
        tree: [populatedContainer],
        active: { id: populatedContainer.id, type: populatedContainer.type },
        policy: mockPolicy,
      };

      const res = resolveDropTargetForNode(selfContext, {
        targetId: toPageNodeId('child-1'),
        pointerY: 50,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(res).toBeNull();
    });

    it('resolves inside drop for empty container', () => {
      const res = resolveDropTargetForNode(context, {
        targetId: emptyContainer.id,
        pointerY: 50,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(res).toEqual({
        kind: 'inside',
        targetNodeId: emptyContainer.id,
        parentId: emptyContainer.id,
        index: 0,
      });
    });

    it('resolves relative drop before/after leaf node', () => {
      const resBefore = resolveDropTargetForNode(context, {
        targetId: leafNode1.id,
        pointerY: 10,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(resBefore).toEqual({
        kind: 'relative',
        targetNodeId: leafNode1.id,
        position: 'before',
        parentId: null,
      });

      const resAfter = resolveDropTargetForNode(context, {
        targetId: leafNode1.id,
        pointerY: 90,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(resAfter).toEqual({
        kind: 'relative',
        targetNodeId: leafNode1.id,
        position: 'after',
        parentId: null,
      });
    });

    it('returns null if policy forbids nesting in parent', () => {
      const restrictedContext: DropContext = {
        tree: [leafNode1],
        active: { id: null, type: 'restricted' },
        policy: mockPolicy,
      };
      const res = resolveDropTargetForNode(restrictedContext, {
        targetId: leafNode1.id,
        pointerY: 10,
        targetRect: { top: 0, left: 0, width: 100, height: 100 },
      });
      expect(res).toBeNull();
    });
  });

  describe('resolveDropTargetAtCanvasEnd', () => {
    it('returns root index 0 for empty tree when allowed by policy', () => {
      const emptyContext: DropContext = {
        tree: [],
        active: { id: null, type: 'text' },
        policy: mockPolicy,
      };
      expect(resolveDropTargetAtCanvasEnd(emptyContext)).toEqual({
        kind: 'root',
        index: 0,
      });
    });

    it('returns null for empty tree when root nesting is forbidden', () => {
      const emptyContext: DropContext = {
        tree: [],
        active: { id: null, type: 'restricted' },
        policy: mockPolicy,
      };
      expect(resolveDropTargetAtCanvasEnd(emptyContext)).toBeNull();
    });

    it('returns relative after last root node', () => {
      const context: DropContext = {
        tree: [leafNode1, emptyContainer],
        active: { id: null, type: 'text' },
        policy: mockPolicy,
      };
      expect(resolveDropTargetAtCanvasEnd(context)).toEqual({
        kind: 'relative',
        targetNodeId: emptyContainer.id,
        position: 'after',
        parentId: null,
      });
    });

    it('returns null if last root node is the active dragged node', () => {
      const context: DropContext = {
        tree: [leafNode1, emptyContainer],
        active: { id: emptyContainer.id, type: emptyContainer.type },
        policy: mockPolicy,
      };
      expect(resolveDropTargetAtCanvasEnd(context)).toBeNull();
    });
  });

  describe('stepDropTarget', () => {
    const context: DropContext = {
      tree: [leafNode1, populatedContainer],
      active: { id: null, type: 'button' },
      policy: mockPolicy,
    };

    it('steps forward to next legal target', () => {
      const step = stepDropTarget(context, leafNode1.id, 1);
      expect(step).not.toBeNull();
      expect(step?.kind).toBe('relative');
    });

    it('steps backward to previous legal target', () => {
      const step = stepDropTarget(context, populatedContainer.id, -1);
      expect(step).toEqual({
        kind: 'relative',
        targetNodeId: leafNode1.id,
        position: 'before',
        parentId: null,
      });
    });

    it('returns null when current node not found or stepping beyond bounds', () => {
      expect(stepDropTarget(context, toPageNodeId('missing'), 1)).toBeNull();
      expect(stepDropTarget(context, leafNode1.id, -1)).toBeNull();
    });
  });

  describe('resolvePlacement', () => {
    it('handles root target', () => {
      const placement = resolvePlacement([], null, { kind: 'root', index: 0 })._unsafeUnwrap();
      expect(placement).toEqual({ parentId: null, index: 0 });
    });

    it('handles inside target', () => {
      const placement = resolvePlacement([emptyContainer], null, {
        kind: 'inside',
        targetNodeId: emptyContainer.id,
        parentId: emptyContainer.id,
        index: 2,
      })._unsafeUnwrap();
      expect(placement).toEqual({ parentId: emptyContainer.id, index: 2 });
    });

    it('handles relative target before and after without active node', () => {
      const tree = [leafNode1, emptyContainer];
      const before = resolvePlacement(tree, null, {
        kind: 'relative',
        targetNodeId: emptyContainer.id,
        position: 'before',
        parentId: null,
      })._unsafeUnwrap();
      expect(before).toEqual({ parentId: null, index: 1 });

      const after = resolvePlacement(tree, null, {
        kind: 'relative',
        targetNodeId: emptyContainer.id,
        position: 'after',
        parentId: null,
      })._unsafeUnwrap();
      expect(after).toEqual({ parentId: null, index: 2 });
    });

    it('compensates index when active node is lifted from earlier sibling position', () => {
      const n1 = { ...leafNode1, id: toPageNodeId('n1') };
      const n2 = { ...leafNode1, id: toPageNodeId('n2') };
      const n3 = { ...leafNode1, id: toPageNodeId('n3') };
      const tree = [n1, n2, n3];

      // Moving n1 to after n3: targetIndex is 2. Position after is 3.
      // Since n1 was at index 0 (< 2), index is adjusted by -1 -> 2.
      const placement = resolvePlacement(tree, n1.id, {
        kind: 'relative',
        targetNodeId: n3.id,
        position: 'after',
        parentId: null,
      })._unsafeUnwrap();
      expect(placement).toEqual({ parentId: null, index: 2 });
    });

    it('fails when parent or target node cannot be found in siblings', () => {
      const missingParent = resolvePlacement([], null, {
        kind: 'relative',
        targetNodeId: toPageNodeId('t1'),
        position: 'before',
        parentId: toPageNodeId('p-missing'),
      });
      expect(missingParent.isErr()).toBe(true);

      const missingTarget = resolvePlacement([leafNode1], null, {
        kind: 'relative',
        targetNodeId: toPageNodeId('t-missing'),
        position: 'before',
        parentId: null,
      });
      expect(missingTarget.isErr()).toBe(true);
    });
  });
});
