import type { JsonValue } from '@lib/utils';

/** A component's props, as stored: plain JSON. */
export type NodeProps = Readonly<Record<string, JsonValue>>;

/**
 * One node of a page tree, in the release module's own terms. The builder
 * owns the real node type; adapters hand its nodes over as they are, which
 * type-checks only while the shapes stay compatible, so a change in the
 * builder surfaces at that one adapter and nowhere else.
 */
export interface TreeNode {
  readonly id: string;
  readonly type: string;
  readonly props: NodeProps;
  /** Always present; a leaf has an empty array. */
  readonly children: readonly TreeNode[];
}

export interface PageTree {
  /** The root page has an empty path. */
  readonly path: string;
  readonly children: readonly TreeNode[];
}

/** How the generic tree helpers in `@lib/utils` walk a node. */
export function childrenOf(node: TreeNode): readonly TreeNode[] {
  return node.children;
}
