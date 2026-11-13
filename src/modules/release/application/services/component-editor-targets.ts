import { flattenForest } from '@lib/utils';

import { childrenOf } from '../../domain/migration/page-tree';

import type { PageTree } from '../../domain/migration/page-tree';
import type { PublishablePage } from '../../domain/publishing/publishable';
import type { ComponentUpdateView } from '../contracts/publication-views';

/** Link only to instances that still exist in the current draft, including nested components. */
export function componentEditorTargets(
  type: string,
  pages: readonly PublishablePage[],
  trees: readonly PageTree[],
): NonNullable<ComponentUpdateView['editorTargets']> {
  return trees.flatMap((tree) => {
    const pageId = pages.find((page) => page.path === tree.path)?.pageId;
    return pageId === undefined
      ? []
      : flattenForest(tree.children, childrenOf)
          .filter(({ node }) => node.type === type)
          .map(({ node }) => ({ pageId, nodeId: node.id, path: tree.path }));
  });
}
