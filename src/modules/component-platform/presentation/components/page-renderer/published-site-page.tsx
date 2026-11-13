import type { ReactNode } from 'react';

import type {
  RenderableNode,
  RenderContext,
} from '../../../application/contracts/component-platform-constraints';

interface PublishedSitePageProps {
  readonly nodes: readonly RenderableNode[];
  readonly context: RenderContext;
  readonly renderNodes: (nodes: readonly RenderableNode[], context: RenderContext) => ReactNode;
}

/** Stored root-level navigation is chrome; the remaining builder composition owns the main landmark. */
export function PublishedSitePage({ nodes, context, renderNodes }: PublishedSitePageProps) {
  const header = nodes.filter(
    (node) => node.type === 'quickLinks' && node.props['placement'] === 'header',
  );
  const footer = nodes.filter(
    (node) => node.type === 'quickLinks' && node.props['placement'] === 'footer',
  );
  const content = nodes.filter((node) => !header.includes(node) && !footer.includes(node));
  return (
    <>
      {renderNodes(header, context)}
      <main id="published-content" tabIndex={-1} className="flex-1">
        {renderNodes(content, context)}
      </main>
      {renderNodes(footer, context)}
    </>
  );
}
