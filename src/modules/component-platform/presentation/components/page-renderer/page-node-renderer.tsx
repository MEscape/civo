import type { ReactNode } from 'react';

import { sectionDensityClass } from '@components/layout/layout-primitives';
import type { SectionDensity } from '@components/layout/layout-primitives';

import { cn } from '@lib/utils';

import { ComponentErrorBoundary } from './component-error-boundary';
import { ComponentErrorFallback } from './component-error-fallback';
import { findImplementation } from './component-implementations';
import { densitiesFor } from './page-rhythm';
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
  /** How much vertical room the node's sections take; set by `nodeDensities` for its sibling list. */
  readonly density?: SectionDensity | undefined;
}

/** Whether a published page would show this node at all. The canvas rhythm follows the same rule. */
function isShown(node: RenderableNode): boolean {
  return node.props['visible'] !== false && findImplementation(node.type) !== undefined;
}

/**
 * One density per node of a sibling list (a page, or the children of a
 * section). Nodes a published page would drop are skipped, so the canvas and
 * the published page space their blocks the same way.
 */
export function nodeDensities(nodes: readonly RenderableNode[]): SectionDensity[] {
  return densitiesFor(nodes.map((node) => (isShown(node) ? node.type : null)));
}

function renderChildNodes(
  nodes: readonly RenderableNode[],
  context: RenderContext,
  services: RenderServices,
): ReactNode {
  const densities = nodeDensities(nodes);

  return nodes.map((child, index) => (
    <PageNodeRenderer
      key={child.id}
      node={child}
      context={context}
      services={services}
      density={densities[index]}
    />
  ));
}

/**
 * The node's own content, never behind Suspense. A streamed block arrives as
 * a hidden segment that only an inline script reveals, so a visitor without
 * JavaScript would never see it; the canvas also measures nodes by their
 * rendered DOM, which a suspended node does not have.
 */
function renderContent(
  node: RenderableNode,
  context: RenderContext,
  services: RenderServices,
): ReactNode {
  const implementation = findImplementation(node.type);
  if (implementation === undefined) {
    return <UnknownComponent type={node.type} />;
  }

  return implementation.render({
    rawProps: node.props,
    context,
    children: renderChildNodes(node.children ?? [], context, services),
    ...services,
  });
}

/**
 * Renders one node: resolves its component, isolates its failures, and on
 * the canvas marks it for the builder's hit testing.
 *
 * A node with `visible: false` is dropped from a published page. On the
 * canvas it stays, dimmed, so the editor can switch it back on. A stale
 * node (an unregistered type) is invisible to visitors: it simply is not
 * there.
 *
 * Density is a CSS variable that the sections inside read through
 * `py-section`. On the canvas it rides on the wrapper that already exists;
 * on a published page a wrapper is added only when the density is not the
 * default, so most blocks add no DOM.
 */
export function PageNodeRenderer({
  node,
  context,
  services,
  density = 'default',
}: PageNodeRendererProps) {
  const isDraft = context.mode === 'draft';
  if (!isDraft && !isShown(node)) {
    return null;
  }

  const densityClass = sectionDensityClass(density);
  const guarded = (
    <ComponentErrorBoundary
      fallback={<ComponentErrorFallback componentType={isDraft ? node.type : null} />}
    >
      {renderContent(node, context, services)}
    </ComponentErrorBoundary>
  );
  if (!isDraft) {
    return densityClass === '' ? guarded : <div className={densityClass}>{guarded}</div>;
  }

  return (
    <div
      data-civo-node-id={node.id}
      data-civo-node-type={node.type}
      aria-hidden={node.props['visible'] === false ? true : undefined}
      className={cn(
        node.props['visible'] === false && 'pointer-events-none opacity-35',
        densityClass,
      )}
    >
      {guarded}
    </div>
  );
}
