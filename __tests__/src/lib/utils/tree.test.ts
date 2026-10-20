import { describe, expect, it } from 'vitest';

import {
  countNodes,
  findPath,
  findPathInForest,
  flattenForest,
  locateInForest,
  mapTree,
  removeFromForest,
  updateForest,
  walkTree,
} from '@lib/utils/tree';
import type { TreeShape } from '@lib/utils/tree';

interface TestNode {
  id: string;
  children?: readonly TestNode[];
}

const tree: TestNode = {
  id: 'root',
  children: [{ id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b' }],
};

const getChildren = (node: TestNode) => node.children;
const shape: TreeShape<TestNode> = {
  getChildren,
  withChildren: (node, children) => ({ ...node, children }),
};
const ids = (nodes: readonly TestNode[]) => nodes.map((node) => node.id);

describe('walkTree', () => {
  it('visits parents before children, depth-first, with depth', () => {
    const visited: Array<[string, number]> = [];
    walkTree(tree, getChildren, (node, depth) => visited.push([node.id, depth]));
    expect(visited).toEqual([
      ['root', 0],
      ['a', 1],
      ['a1', 2],
      ['a2', 2],
      ['b', 1],
    ]);
  });

  it('visits a leaf alone', () => {
    const visited: string[] = [];

    walkTree({ id: 'solo' }, getChildren, (node) => visited.push(node.id));

    expect(visited).toEqual(['solo']);
  });
});

describe('countNodes', () => {
  it('counts every node including the root', () => {
    expect(countNodes(tree, getChildren)).toBe(5);
    expect(countNodes({ id: 'solo' }, getChildren)).toBe(1);
  });
});

describe('mapTree', () => {
  it('rebuilds the tree without mutating the input', () => {
    const upper = mapTree<TestNode, TestNode>(tree, getChildren, (node, children) => ({
      id: node.id.toUpperCase(),
      ...(children.length > 0 ? { children } : {}),
    }));
    expect(upper.id).toBe('ROOT');
    expect(upper.children?.[0]?.children?.map((c) => c.id)).toEqual(['A1', 'A2']);
    expect(tree.id).toBe('root');
  });
});

describe('findPath', () => {
  it('returns the root-to-node path', () => {
    expect(findPath(tree, getChildren, (n) => n.id === 'a2')?.map((n) => n.id)).toEqual([
      'root',
      'a',
      'a2',
    ]);
  });

  it('is just the root when the root matches', () => {
    expect(ids(findPath(tree, getChildren, (n) => n.id === 'root') ?? [])).toEqual(['root']);
  });

  it('returns undefined when nothing matches', () => {
    expect(findPath(tree, getChildren, (n) => n.id === 'zzz')).toBeUndefined();
  });
});

describe('forest functions', () => {
  const forest: readonly TestNode[] = [tree, { id: 'second', children: [{ id: 's1' }] }];

  describe('flattenForest', () => {
    it('lists every node depth-first with its parent and depth', () => {
      const entries = flattenForest(forest, getChildren);

      expect(
        entries.map((entry) => [entry.node.id, entry.parent?.id ?? null, entry.depth]),
      ).toEqual([
        ['root', null, 0],
        ['a', 'root', 1],
        ['a1', 'a', 2],
        ['a2', 'a', 2],
        ['b', 'root', 1],
        ['second', null, 0],
        ['s1', 'second', 1],
      ]);
    });

    it('is empty for an empty forest', () => {
      expect(flattenForest([], getChildren)).toEqual([]);
    });
  });

  describe('locateInForest', () => {
    it('finds the node with its siblings, index and parent', () => {
      const found = locateInForest(forest, getChildren, (n) => n.id === 'a2');

      expect(found?.node.id).toBe('a2');
      expect(found?.parent?.id).toBe('a');
      expect(found?.index).toBe(1);
      expect(ids(found?.siblings ?? [])).toEqual(['a1', 'a2']);
    });

    it('finds a root with no parent', () => {
      const found = locateInForest(forest, getChildren, (n) => n.id === 'second');

      expect(found?.parent).toBeNull();
      expect(found?.index).toBe(1);
    });

    it('is undefined when nothing matches', () => {
      expect(locateInForest(forest, getChildren, (n) => n.id === 'zzz')).toBeUndefined();
    });
  });

  describe('findPathInForest', () => {
    it('returns the path from the root that holds the match', () => {
      expect(ids(findPathInForest(forest, getChildren, (n) => n.id === 's1') ?? [])).toEqual([
        'second',
        's1',
      ]);
    });

    it('is undefined when nothing matches', () => {
      expect(findPathInForest(forest, getChildren, (n) => n.id === 'zzz')).toBeUndefined();
    });
  });

  describe('updateForest', () => {
    it('rebuilds only the path to what changed, sharing the rest', () => {
      const next = updateForest(forest, shape, (node) =>
        node.id === 'a2' ? { ...node, id: 'a2-new' } : node,
      );

      expect(next).not.toBe(forest);
      expect(next[1]).toBe(forest[1]);
      expect(next[0]?.children?.[1]).toBe(forest[0]?.children?.[1]);
      expect(ids(next[0]?.children?.[0]?.children ?? [])).toEqual(['a1', 'a2-new']);
    });

    it('returns the input itself when nothing changed', () => {
      expect(updateForest(forest, shape, (node) => node)).toBe(forest);
    });

    it('applies the transform to parents before looking at their children', () => {
      const next = updateForest(forest, shape, (node) =>
        node.id === 'a' ? { id: 'a', children: [] } : node,
      );

      expect(next[0]?.children?.[0]?.children).toEqual([]);
    });
  });

  describe('removeFromForest', () => {
    it('removes matching nodes with their subtrees, sharing the rest', () => {
      const next = removeFromForest(forest, shape, (n) => n.id === 'a');

      expect(ids(next[0]?.children ?? [])).toEqual(['b']);
      expect(next[1]).toBe(forest[1]);
    });

    it('removes a root', () => {
      expect(ids(removeFromForest(forest, shape, (n) => n.id === 'root'))).toEqual(['second']);
    });

    it('returns the input itself when nothing matched', () => {
      expect(removeFromForest(forest, shape, (n) => n.id === 'zzz')).toBe(forest);
    });
  });
});
