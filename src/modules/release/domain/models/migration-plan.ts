import { flattenForest, literalGuard } from '@lib/utils';

import { threeWayMergeProps } from './three-way-merge';

import type { MigrationSource } from './migration-source';
import type { NodeProps, TreeNode } from './page-tree';
import type { FieldConflict } from './three-way-merge';
import type { ComponentCatalog } from '../ports/component-catalog.port';

export const NODE_MIGRATION_STATUSES = [
  'unchanged',
  'upgradable',
  'needs_review',
  'unresolvable',
] as const;
export type NodeMigrationStatus = (typeof NODE_MIGRATION_STATUSES)[number];
export const isNodeMigrationStatus = literalGuard(NODE_MIGRATION_STATUSES);

/** Why a node cannot be planned at all. */
export const UNRESOLVABLE_REASONS = ['type_unregistered', 'version_unregistered'] as const;
export type UnresolvableReason = (typeof UNRESOLVABLE_REASONS)[number];
export const isUnresolvableReason = literalGuard(UNRESOLVABLE_REASONS);

interface NodePlanBase {
  readonly nodeId: string;
  readonly type: string;
  /** The version the release recorded when it was published. */
  readonly fromVersion: number;
}

/**
 * One node's plan. A union rather than a bag of optional fields, so
 * `mergedProps` exists exactly where it is meaningful and no caller has to
 * guess whether it was set.
 */
export type NodeMigrationPlan =
  | (NodePlanBase & {
      readonly status: 'unchanged';
      readonly toVersion: number;
    })
  | (NodePlanBase & {
      readonly status: 'upgradable';
      readonly toVersion: number;
      readonly mergedProps: NodeProps;
      readonly addedFields: readonly string[];
    })
  | (NodePlanBase & {
      readonly status: 'needs_review';
      readonly toVersion: number;
      readonly mergedProps: NodeProps;
      readonly conflicts: readonly FieldConflict[];
      readonly addedFields: readonly string[];
    })
  | (NodePlanBase & {
      readonly status: 'unresolvable';
      readonly reason: UnresolvableReason;
    });

export interface PageMigrationPlan {
  readonly path: string;
  readonly nodes: readonly NodeMigrationPlan[];
}

export interface MigrationPlan {
  readonly pages: readonly PageMigrationPlan[];
}

export type NodeStatusCounts = Readonly<Record<NodeMigrationStatus, number>>;

function planNode(
  node: TreeNode,
  fromVersion: number,
  components: ComponentCatalog,
): NodeMigrationPlan {
  const base = { nodeId: node.id, type: node.type, fromVersion };

  const current = components.resolve(node.type);
  // Without a registered current version there is nothing to compare
  // `fromVersion` against, so this must come before the unchanged check.
  if (current === null) {
    return { ...base, status: 'unresolvable', reason: 'type_unregistered' };
  }
  const toVersion = current.version;
  if (toVersion === fromVersion) {
    return { ...base, status: 'unchanged', toVersion };
  }

  // BASE is the old version's own defaults, asked for now. Sound because a
  // registered component version is immutable once published: its defaults
  // today are the defaults it had when the node was created against it.
  const oldDefaults = components.defaultProps(node.type, fromVersion);
  const newDefaults = components.defaultProps(node.type, toVersion);
  if (oldDefaults === null || newDefaults === null) {
    return { ...base, status: 'unresolvable', reason: 'version_unregistered' };
  }

  const { merged, conflicts, addedFields } = threeWayMergeProps(
    oldDefaults,
    node.props,
    newDefaults,
  );

  if (conflicts.length === 0) {
    return {
      ...base,
      status: 'upgradable',
      toVersion,
      mergedProps: merged,
      addedFields,
    };
  }
  return {
    ...base,
    status: 'needs_review',
    toVersion,
    mergedProps: merged,
    conflicts,
    addedFields,
  };
}

/**
 * Plans the upgrade of a published release to today's registered component
 * versions: every node on every page, compared against the current
 * registry.
 *
 * There is deliberately no equivalent for a never-published draft: a draft
 * has no recorded "version this was built against", so there is nothing to
 * migrate FROM. Editing a draft is ordinary editing.
 *
 * A node whose type has no pin is left out: the release recorded nothing to
 * migrate it from.
 */
export function planMigration(
  source: MigrationSource,
  components: ComponentCatalog,
): MigrationPlan {
  const versionByType = new Map(source.pins.map((pin) => [pin.type, pin.version] as const));

  return {
    pages: source.pages.map((page) => ({
      path: page.path,
      nodes: flattenForest(page.children, (node) => node.children).flatMap(({ node }) => {
        const fromVersion = versionByType.get(node.type);
        return fromVersion === undefined ? [] : [planNode(node, fromVersion, components)];
      }),
    })),
  };
}

function allNodes(plan: MigrationPlan): readonly NodeMigrationPlan[] {
  return plan.pages.flatMap((page) => page.nodes);
}

export function countNodesByStatus(plan: MigrationPlan): NodeStatusCounts {
  const counts = {
    unchanged: 0,
    upgradable: 0,
    needs_review: 0,
    unresolvable: 0,
  };
  for (const node of allNodes(plan)) {
    counts[node.status] += 1;
  }
  return counts;
}

/** Nothing to migrate: every node already runs the current version. */
export function isUpToDate(plan: MigrationPlan): boolean {
  return allNodes(plan).every((node) => node.status === 'unchanged');
}

/** A human has to look before anything can be applied in full. */
export function requiresReview(plan: MigrationPlan): boolean {
  return allNodes(plan).some(
    (node) => node.status === 'needs_review' || node.status === 'unresolvable',
  );
}
