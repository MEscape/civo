import { describe, expect, it } from 'vitest';

import { countNodes, findNode, findPath, flattenTree, mapTree, walkTree } from '@lib/utils/tree';

interface TestNode {
  id: string;
  children?: TestNode[];
}

const tree: TestNode = {
  id: 'root',
  children: [{ id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b' }],
};

const getChildren = (node: TestNode) => node.children;

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
});

describe('flattenTree', () => {
  it('returns all nodes in depth-first order', () => {
    expect(flattenTree(tree, getChildren).map((n) => n.id)).toEqual(['root', 'a', 'a1', 'a2', 'b']);
  });
});

describe('findNode', () => {
  it('finds the first matching node', () => {
    expect(findNode(tree, getChildren, (n) => n.id === 'a2')?.id).toBe('a2');
  });

  it('returns undefined when nothing matches', () => {
    expect(findNode(tree, getChildren, (n) => n.id === 'zzz')).toBeUndefined();
  });
});

describe('countNodes', () => {
  it('counts every node including the root', () => {
    expect(countNodes(tree, getChildren)).toBe(5);
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

  it('returns undefined when nothing matches', () => {
    expect(findPath(tree, getChildren, (n) => n.id === 'zzz')).toBeUndefined();
  });
});
