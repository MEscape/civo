import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { ComponentErrorBoundary } from './component-error-boundary';
import { ComponentErrorFallback } from './component-error-fallback';
import { findImplementation } from './component-implementations';
import { UnknownComponent } from './unknown-component';

import type { RenderServices } from './component-implementation';
import type {
  RenderContext,
  RenderableNode,
} from '../../../application/contracts/component-platform-constraints';

export interface PageNodeRendererProps {
  readonly node: RenderableNode;
  readonly context: RenderContext;
  readonly services: RenderServices;
}

function renderChildNodes(
  nodes: readonly RenderableNode[],
  context: RenderContext,
  services: RenderServices,
): ReactNode {
  return nodes.map((child) => (
    <PageNodeRenderer key={child.id} node={child} context={context} services={services} />
  ));
}

/**
 * The node's own content. A published page streams a data component behind
 * its skeleton; the canvas does not, because it measures nodes by their
 * rendered DOM and a node that is still suspended has none.
 */
function renderContent({ node, context, services }: PageNodeRendererProps): ReactNode {
  const implementation = findImplementation(node.type);
  if (implementation === undefined) {
    return <UnknownComponent type={node.type} />;
  }

  const content = implementation.render({
    rawProps: node.props,
    context,
    children: renderChildNodes(node.children ?? [], context, services),
    ...services,
  });
  const streams = context.mode === 'published' && implementation.skeleton !== null;
  return streams ? <Suspense fallback={implementation.skeleton}>{content}</Suspense> : content;
}

/**
 * Renders one node: resolves its component, isolates its failures, and on
 * the canvas marks it for the builder's hit testing.
 *
 * A node with `visible: false` is dropped from a published page. On the
 * canvas it stays, dimmed, so the editor can switch it back on. A stale
 * node (an unregistered type) is invisible to visitors: it simply is not
 * there.
 */
export function PageNodeRenderer(props: PageNodeRendererProps) {
  const { node, context } = props;
  const isDraft = context.mode === 'draft';
  const isHidden = node.props['visible'] === false;
  const isStale = findImplementation(node.type) === undefined;
  if (!isDraft && (isHidden || isStale)) {
    return null;
  }

  const guarded = (
    <ComponentErrorBoundary
      fallback={<ComponentErrorFallback componentType={isDraft ? node.type : null} />}
    >
      {renderContent(props)}
    </ComponentErrorBoundary>
  );
  if (!isDraft) {
    return guarded;
  }

  return (
    <div
      data-civo-node-id={node.id}
      data-civo-node-type={node.type}
      aria-hidden={isHidden ? true : undefined}
      className={isHidden ? 'pointer-events-none opacity-35' : undefined}
    >
      {guarded}
    </div>
  );
}
