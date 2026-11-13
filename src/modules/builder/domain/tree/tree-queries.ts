import { countNodes, findPathInForest, flattenForest, locateInForest, unique } from '@lib/utils';
import type { TreeShape } from '@lib/utils';

import type { PageNodeId } from '../models/ids';
import type { PageNode } from '../models/page-node';

/*
 * Read-only questions about a page tree (where is a node, what is below it,
 * which types are used). Pure and never mutating; the edits live in
 * `tree-operations`.
 */

export interface NodeLocation {
  readonly node: PageNode;
  readonly siblings: readonly PageNode[];
  readonly index: number;
  readonly parentId: PageNodeId | null;
}

export interface FlatNode {
  readonly node: PageNode;
  readonly parentId: PageNodeId | null;
  readonly depth: number;
}

/** How the generic forest helpers read and rebuild a `PageNode`. */
export const PAGE_TREE: TreeShape<PageNode> = {
  getChildren: (node) => node.children,
  withChildren: (node, children) => ({ ...node, children }),
};

export function locateNode(nodes: readonly PageNode[], nodeId: PageNodeId): NodeLocation | null {
  const found = locateInForest(nodes, PAGE_TREE.getChildren, (node) => node.id === nodeId);
  if (found === undefined) {
    return null;
  }
  return {
    node: found.node,
    siblings: found.siblings,
    index: found.index,
    parentId: found.parent?.id ?? null,
  };
}

export function findNode(nodes: readonly PageNode[], nodeId: PageNodeId): PageNode | null {
  return locateNode(nodes, nodeId)?.node ?? null;
}

/** The siblings array under `parentId`, or `null` when that parent does not exist. */
export function childrenOf(
  nodes: readonly PageNode[],
  parentId: PageNodeId | null,
): readonly PageNode[] | null {
  if (parentId === null) {
    return nodes;
  }
  return findNode(nodes, parentId)?.children ?? null;
}

/** Root-to-parent chain of a node, excluding the node itself. */
export function getAncestors(nodes: readonly PageNode[], nodeId: PageNodeId): readonly PageNode[] {
  const path = findPathInForest(nodes, PAGE_TREE.getChildren, (node) => node.id === nodeId);
  return path?.slice(0, -1) ?? [];
}

/** Depth-first, parents before children: the render order. */
export function flattenNodes(nodes: readonly PageNode[]): FlatNode[] {
  return flattenForest(nodes, PAGE_TREE.getChildren).map(({ node, parent, depth }) => ({
    node,
    parentId: parent?.id ?? null,
    depth,
  }));
}

export function countPageNodes(nodes: readonly PageNode[]): number {
  return nodes.reduce((total, root) => total + countNodes(root, PAGE_TREE.getChildren), 0);
}

/** Distinct component types used anywhere in the forest, in first-seen render order. */
export function collectNodeTypes(nodes: readonly PageNode[]): readonly string[] {
  return unique(flattenNodes(nodes).map((entry) => entry.node.type));
}

/** True when `candidateId` is anywhere below `ancestor` (excluding `ancestor` itself). */
export function isInSubtree(ancestor: PageNode, candidateId: PageNodeId): boolean {
  return ancestor.children.some(
    (child) => child.id === candidateId || isInSubtree(child, candidateId),
  );
}
