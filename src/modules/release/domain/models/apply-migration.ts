import { assertNever, deepEqual, mapTree, omit } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { childrenOf } from './page-tree';

import type { ConflictResolution, ConflictResolutions } from './conflict-resolution';
import type { MigrationPlan, NodeMigrationPlan } from './migration-plan';
import type { NodeProps, PageTree, TreeNode } from './page-tree';
import type { FieldConflict } from './three-way-merge';

/** A page whose tree was rewritten, with what changed on it. */
export interface AppliedPage {
  readonly path: string;
  readonly children: readonly TreeNode[];
  /** Nodes whose props now differ from before. Never empty for a returned page. */
  readonly updatedNodeIds: readonly string[];
  /** Nodes that had conflicts without a full set of resolutions, left exactly as they were. */
  readonly skippedNodeIds: readonly string[];
}

export interface ApplyMigrationResult {
  /** Only pages that actually changed: no page is rewritten for nothing. */
  readonly changedPages: readonly AppliedPage[];
  /** Nodes skipped across ALL pages, including pages that changed nowhere else. */
  readonly skippedNodeCount: number;
}

type FieldSettlement =
  { readonly kind: 'set'; readonly value: JsonValue } | { readonly kind: 'remove' };

function settle(conflict: FieldConflict, resolution: ConflictResolution): FieldSettlement {
  switch (resolution.action) {
    case 'keep_local':
      return conflict.local === undefined
        ? { kind: 'remove' }
        : { kind: 'set', value: conflict.local };
    case 'use_new':
      // A field the new version dropped has no incoming value: using "new" removes it.
      return conflict.kind === 'both_changed'
        ? { kind: 'set', value: conflict.incoming }
        : { kind: 'remove' };
    case 'custom':
      return { kind: 'set', value: resolution.value };
    default:
      return assertNever(resolution);
  }
}

/**
 * A reviewed node is applied all or nothing, never per field: either every
 * conflict has an explicit resolution, or the node keeps its old props. An
 * unresolved conflict must never apply partially (no silent data loss).
 */
function resolveConflicts(
  mergedProps: NodeProps,
  conflicts: readonly FieldConflict[],
  resolutions: Readonly<Record<string, ConflictResolution>> | undefined,
): NodeProps | null {
  let finalProps: NodeProps = mergedProps;

  for (const conflict of conflicts) {
    const resolution = resolutions?.[conflict.key];
    if (resolution === undefined) {
      return null;
    }

    const settlement = settle(conflict, resolution);
    finalProps =
      settlement.kind === 'remove'
        ? omit(finalProps, [conflict.key])
        : { ...finalProps, [conflict.key]: settlement.value };
  }
  return finalProps;
}

/** The node's final props, or `null` when the node must stay untouched. */
function resolveNodeProps(
  plan: NodeMigrationPlan,
  resolutions: Readonly<Record<string, ConflictResolution>> | undefined,
): NodeProps | null {
  switch (plan.status) {
    case 'unchanged':
    case 'unresolvable':
      return null;
    case 'upgradable':
      return plan.mergedProps;
    case 'needs_review':
      return resolveConflicts(plan.mergedProps, plan.conflicts, resolutions);
    default:
      return assertNever(plan);
  }
}

interface AppliedNode {
  readonly node: TreeNode;
  readonly updatedNodeIds: readonly string[];
  readonly skippedNodeIds: readonly string[];
}

type PageResolutions = ConflictResolutions[string];

/** Folds one subtree bottom-up: children first, then the node itself. */
function applyToNode(
  root: TreeNode,
  plans: ReadonlyMap<string, NodeMigrationPlan>,
  resolutions: PageResolutions,
): AppliedNode {
  return mapTree<TreeNode, AppliedNode>(root, childrenOf, (node, appliedChildren) => {
    // Children are visited even when the node itself has no plan: a plain
    // container can hold migratable descendants.
    const children = appliedChildren.map((applied) => applied.node);
    const updatedNodeIds = appliedChildren.flatMap((applied) => applied.updatedNodeIds);
    const skippedNodeIds = appliedChildren.flatMap((applied) => applied.skippedNodeIds);

    const plan = plans.get(node.id);
    if (plan === undefined) {
      return { node: { ...node, children }, updatedNodeIds, skippedNodeIds };
    }

    const props = resolveNodeProps(plan, resolutions[node.id]);
    if (props === null) {
      return {
        node: { ...node, children },
        updatedNodeIds,
        skippedNodeIds:
          plan.status === 'needs_review' ? [...skippedNodeIds, node.id] : skippedNodeIds,
      };
    }

    const isChanged = !deepEqual(props, node.props);
    return {
      node: { ...node, props, children },
      updatedNodeIds: isChanged ? [...updatedNodeIds, node.id] : updatedNodeIds,
      skippedNodeIds,
    };
  });
}

/**
 * Applies a plan's resolutions to the page trees it was computed from and
 * returns new trees. Pure: it never writes anything, and the tree
 * STRUCTURE (which nodes exist, their order, their nesting) is never
 * touched, only `props` of nodes the plan identified.
 *
 * `pages` must be the same pages `planMigration` was given. A node without
 * a plan is passed through untouched, since a caller that re-derives the
 * pages from somewhere else is a bug this function cannot detect from the
 * data alone.
 */
export function applyMigrationPlan(
  plan: MigrationPlan,
  pages: readonly PageTree[],
  resolutions: ConflictResolutions,
): ApplyMigrationResult {
  const applied = pages.map((page) => {
    const pagePlan = plan.pages.find((candidate) => candidate.path === page.path);
    const plans = new Map((pagePlan?.nodes ?? []).map((node) => [node.nodeId, node] as const));
    const pageResolutions = resolutions[page.path] ?? {};

    const results = page.children.map((node) => applyToNode(node, plans, pageResolutions));
    return {
      path: page.path,
      children: results.map((result) => result.node),
      updatedNodeIds: results.flatMap((result) => result.updatedNodeIds),
      skippedNodeIds: results.flatMap((result) => result.skippedNodeIds),
    };
  });

  return {
    changedPages: applied.filter((page) => page.updatedNodeIds.length > 0),
    skippedNodeCount: applied.reduce((total, page) => total + page.skippedNodeIds.length, 0),
  };
}
