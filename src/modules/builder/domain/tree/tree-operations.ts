import type { NotFoundAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import {
  countNodes,
  findPathInForest,
  flattenForest,
  insertItem,
  isDefined,
  locateInForest,
  removeFromForest,
  unique,
  updateForest,
} from '@lib/utils';
import type { JsonValue, TreeShape } from '@lib/utils';

import {
  BUILDER_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  pageNodeNotFound,
  placementRejected,
} from '../errors/builder-errors';
import { deriveNodeId, parseIdSeed } from '../models/ids';
import { isWithinDepthLimit, isWithinNodeLimit } from '../models/page-node';

import type { ComponentCatalog, NestingPolicy } from '../models/component-catalog';
import type { NodeBlueprint } from '../models/component-descriptor';
import type { PageNodeId } from '../models/ids';
import type { PageNode, PageNodeProps, PageNodePropsPatch } from '../models/page-node';

/*
 * Pure page-tree operations. Deterministic, never mutating, independent of
 * React, the DOM and Redux, so the same code backs the client editor, a
 * server-side transformation and tests. Every operation that can be refused
 * returns an `AppResult` instead of silently returning the old tree.
 *
 * All operations work on a forest (the page root, or any node's children).
 * Unchanged subtrees keep their identity (structural sharing, provided by
 * the `@lib/utils` forest helpers), which is what lets `isDirty` and
 * memoized renderers rely on reference equality.
 *
 * Depth is zero-based: root nodes sit at depth 0.
 */

export type NodeOperationError = NotFoundAppError | ValidationAppError;

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

/** A concrete insertion point. `index` counts siblings AFTER any removal. */
export interface Placement {
  readonly parentId: PageNodeId | null;
  readonly index: number;
}

export interface DuplicatedNode {
  readonly tree: readonly PageNode[];
  readonly newNodeId: PageNodeId;
}

/** Pass as `index` to append; insertion clamps it to the sibling count. */
export const APPEND_INDEX = Number.MAX_SAFE_INTEGER;

/** How the generic forest helpers read and rebuild a `PageNode`. */
const PAGE_TREE: TreeShape<PageNode> = {
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

function updateNodes(
  nodes: readonly PageNode[],
  transform: (node: PageNode) => PageNode,
): readonly PageNode[] {
  return updateForest(nodes, PAGE_TREE, transform);
}

function removeSubtree(nodes: readonly PageNode[], nodeId: PageNodeId): readonly PageNode[] {
  return removeFromForest(nodes, PAGE_TREE, (node) => node.id === nodeId);
}

/** Mechanical insertion with no checks; callers have already validated the placement. */
function insertAt(
  nodes: readonly PageNode[],
  node: PageNode,
  placement: Placement,
): readonly PageNode[] {
  if (placement.parentId === null) {
    return insertItem(nodes, placement.index, node);
  }
  return updateNodes(nodes, (current) =>
    current.id === placement.parentId
      ? {
          ...current,
          children: insertItem(current.children, placement.index, node),
        }
      : current,
  );
}

function requireLocation(
  nodes: readonly PageNode[],
  nodeId: PageNodeId,
): AppResult<NodeLocation, NotFoundAppError> {
  const location = locateNode(nodes, nodeId);
  return location === null ? err(pageNodeNotFound()) : ok(location);
}

function resolveParent(
  nodes: readonly PageNode[],
  parentId: PageNodeId | null,
): AppResult<PageNode | null, NotFoundAppError> {
  if (parentId === null) {
    return ok(null);
  }
  const parent = findNode(nodes, parentId);
  return parent === null ? err(pageNodeNotFound()) : ok(parent);
}

/** True when any id in `candidate`'s subtree already exists in `nodes`. */
function collidesWithIds(nodes: readonly PageNode[], candidate: PageNode): boolean {
  const existing = new Set(flattenNodes(nodes).map((entry) => entry.node.id));
  return flattenNodes([candidate]).some((entry) => existing.has(entry.node.id));
}

/** The editor refuses what a save would reject, so the user finds out immediately. */
function checkTreeLimits(
  tree: readonly PageNode[],
): AppResult<readonly PageNode[], ValidationAppError> {
  const flat = flattenNodes(tree);
  if (!isWithinNodeLimit(flat.length)) {
    return err(fieldValidationFailed('tree', CODES.nodeLimitExceeded));
  }
  if (flat.some((entry) => !isWithinDepthLimit(entry.depth))) {
    return err(fieldValidationFailed('tree', CODES.depthLimitExceeded));
  }
  return ok(tree);
}

function createOrdinalCounter(): () => number {
  let ordinal = 0;
  return () => {
    ordinal += 1;
    return ordinal;
  };
}

/** Assigns ids in pre-order (see `deriveNodeId`), so a node's id never depends on its descendants. */
function withDerivedIds(source: NodeBlueprint, seed: string, nextOrdinal: () => number): PageNode {
  const id = deriveNodeId(source.type, seed, nextOrdinal());
  return {
    id,
    type: source.type,
    props: source.props,
    children: source.children.map((child) => withDerivedIds(child, seed, nextOrdinal)),
  };
}

/** Instantiates a component's default blueprint with fresh, seed-derived ids. */
export function createNodeFromBlueprint(
  blueprint: NodeBlueprint,
  idSeed: string,
): AppResult<PageNode, ValidationAppError> {
  return parseIdSeed(idSeed).map((seed) => withDerivedIds(blueprint, seed, createOrdinalCounter()));
}

/**
 * Inserts a new node. Refused when an id already exists, the parent is
 * missing, nesting is not allowed or the tree would exceed its limits.
 */
export function insertNode(
  nodes: readonly PageNode[],
  { node: newNode, placement }: { readonly node: PageNode; readonly placement: Placement },
  policy: NestingPolicy,
): AppResult<readonly PageNode[], NodeOperationError> {
  return resolveParent(nodes, placement.parentId).andThen(
    (parent): AppResult<readonly PageNode[], NodeOperationError> => {
      const isRejected =
        collidesWithIds(nodes, newNode) || !policy.canNest(parent?.type ?? null, newNode.type);
      if (isRejected) {
        return err(placementRejected());
      }
      return checkTreeLimits(insertAt(nodes, newNode, placement));
    },
  );
}

/** A tree after an edit, with the node the editor should focus next. */
export interface InsertedComponent {
  readonly tree: readonly PageNode[];
  readonly newNodeId: PageNodeId;
}

/**
 * "Add a fresh component here": instantiates the component's default
 * blueprint and inserts it. The one definition shared by click-to-add and
 * drag from the palette, so the two cannot drift.
 */
export function insertNewComponent(input: {
  readonly nodes: readonly PageNode[];
  readonly catalog: ComponentCatalog;
  readonly componentType: string;
  readonly placement: Placement;
  readonly idSeed: string;
}): AppResult<InsertedComponent, NodeOperationError> {
  const { nodes, catalog, componentType, placement, idSeed } = input;
  const descriptor = catalog.describe(componentType);
  if (descriptor === null) {
    return err(fieldValidationFailed('type', CODES.nodeTypeUnknown));
  }
  return createNodeFromBlueprint(descriptor.blueprint, idSeed).andThen(
    (node): AppResult<InsertedComponent, NodeOperationError> =>
      insertNode(nodes, { node, placement }, catalog).map((tree) => ({
        tree,
        newNodeId: node.id,
      })),
  );
}

/** Removes a node and its subtree. */
export function removeNode(
  nodes: readonly PageNode[],
  nodeId: PageNodeId,
): AppResult<readonly PageNode[], NotFoundAppError> {
  return requireLocation(nodes, nodeId).map(() => removeSubtree(nodes, nodeId));
}

function mergeProps(current: PageNodeProps, patch: PageNodePropsPatch): PageNodeProps {
  const merged: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (isDefined(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

/** Applies a prop patch; unrelated props are preserved, `undefined` values remove their key. */
export function updateNodeProps(
  nodes: readonly PageNode[],
  nodeId: PageNodeId,
  patch: PageNodePropsPatch,
): AppResult<readonly PageNode[], NotFoundAppError> {
  return requireLocation(nodes, nodeId).map(() =>
    updateNodes(nodes, (node) =>
      node.id === nodeId ? { ...node, props: mergeProps(node.props, patch) } : node,
    ),
  );
}

/**
 * Moves a node to `placement` (index counted after the node is lifted out).
 * Refused when the target is the node itself or inside its own subtree (a
 * cycle), when nesting is not allowed or when the depth limit would break.
 */
export function moveNode(
  nodes: readonly PageNode[],
  { nodeId, placement }: { readonly nodeId: PageNodeId; readonly placement: Placement },
  policy: NestingPolicy,
): AppResult<readonly PageNode[], NodeOperationError> {
  return requireLocation(nodes, nodeId).andThen(
    (location): AppResult<readonly PageNode[], NodeOperationError> =>
      resolveParent(nodes, placement.parentId).andThen(
        (parent): AppResult<readonly PageNode[], NodeOperationError> => {
          const isCycle =
            parent !== null && (parent.id === nodeId || isInSubtree(location.node, parent.id));
          if (isCycle || !policy.canNest(parent?.type ?? null, location.node.type)) {
            return err(placementRejected());
          }
          return checkTreeLimits(insertAt(removeSubtree(nodes, nodeId), location.node, placement));
        },
      ),
  );
}

/**
 * Duplicates a node and its whole subtree right after the original. Every
 * clone gets a fresh id derived from `idSeed`: ids are never copied. A seed
 * that was used before collides and is refused.
 */
export function duplicateNode(
  nodes: readonly PageNode[],
  nodeId: PageNodeId,
  idSeed: string,
): AppResult<DuplicatedNode, NodeOperationError> {
  return requireLocation(nodes, nodeId).andThen(
    (location): AppResult<DuplicatedNode, NodeOperationError> =>
      parseIdSeed(idSeed).andThen((seed): AppResult<DuplicatedNode, NodeOperationError> => {
        const clone = withDerivedIds(location.node, seed, createOrdinalCounter());
        if (collidesWithIds(nodes, clone)) {
          return err(fieldValidationFailed('idSeed', CODES.idSeedReused));
        }
        const tree = insertAt(nodes, clone, {
          parentId: location.parentId,
          index: location.index + 1,
        });
        return checkTreeLimits(tree).map((checked) => ({
          tree: checked,
          newNodeId: clone.id,
        }));
      }),
  );
}

/**
 * Where selection goes after `removedId` is deleted: the next sibling, else
 * the previous, else the parent, else nothing. Unchanged when something
 * else was selected.
 */
export function nextSelectionAfterRemoval(
  nodes: readonly PageNode[],
  removedId: PageNodeId,
  selectedId: PageNodeId | null,
): PageNodeId | null {
  if (selectedId !== removedId) {
    return selectedId;
  }
  const location = locateNode(nodes, removedId);
  if (location === null) {
    return null;
  }
  return (
    location.siblings[location.index + 1]?.id ??
    location.siblings[location.index - 1]?.id ??
    location.parentId
  );
}
