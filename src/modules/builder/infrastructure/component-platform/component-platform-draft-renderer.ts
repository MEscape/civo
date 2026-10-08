import type { ReactNode } from 'react';

import type { RenderableNode, RenderContext } from '@modules/component-platform';

import type { WebsiteId } from '../../domain/models/ids';
import type { PageNode } from '../../domain/models/page-node';
import type { DraftPageRenderer } from '../../domain/ports/draft-page-renderer.port';

/** The platform's page renderer, as `composition.ts` hands it in. */
export type RenderPageNodesFn = (
  nodes: readonly RenderableNode[],
  context: RenderContext,
) => ReactNode;

/**
 * Renders drafts through the platform's real pipeline, so the canvas, the
 * preview and the public site share one renderer. `draft` mode marks every
 * rendered node with `data-civo-node-id` for hit testing and drag and drop.
 * The element tree travels to the client through the RSC payload.
 * Unregistered types render the platform's placeholder, which is why a
 * stored page with a removed component can still be opened and repaired.
 *
 * The domain's `PageNode` satisfies the platform's `RenderableNode`
 * structurally, so the tree is passed as is: no copy, no cast.
 */
export class ComponentPlatformDraftRenderer implements DraftPageRenderer<ReactNode> {
  constructor(private readonly renderNodes: RenderPageNodesFn) {}

  render(input: {
    readonly websiteId: WebsiteId;
    readonly children: readonly PageNode[];
  }): ReactNode {
    return this.renderNodes(input.children, {
      mode: 'draft',
      websiteId: input.websiteId,
    });
  }
}
