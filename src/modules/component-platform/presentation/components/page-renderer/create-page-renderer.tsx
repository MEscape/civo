import type { ReactNode } from 'react';

import { nodeDensities, PageNodeRenderer } from './page-node-renderer';

import type { RenderServices } from './component-implementation';
import type {
  RenderContext,
  RenderableNode,
} from '../../../application/contracts/component-platform-constraints';

/**
 * Builds the single entry point for rendering a page's node tree, for both
 * the public site (`published`) and the builder canvas (`draft`). The
 * context carries the website, which the server derives, never the page's
 * own props. The services are injected from `composition.ts`.
 *
 * The page's top-level blocks get their spacing rhythm here (see
 * `page-rhythm.ts`); the children of a section get theirs in
 * `PageNodeRenderer`.
 */
export function createPageRenderer(services: RenderServices) {
  return function renderPageNodes(
    nodes: readonly RenderableNode[],
    context: RenderContext,
  ): ReactNode {
    const densities = nodeDensities(nodes);

    return nodes.map((node, index) => (
      <PageNodeRenderer
        key={node.id}
        node={node}
        context={context}
        services={services}
        density={densities[index]}
      />
    ));
  };
}
