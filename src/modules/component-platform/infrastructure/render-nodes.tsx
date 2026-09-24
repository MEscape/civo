import React, { createElement, Suspense, type ComponentType } from "react";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { type PageComponentProps, isRegisteredComponentType } from "@/modules/component-platform/domain";
import { componentMap, skeletonMap } from "./registry";
// Side-effect import: registers every feature module's component
// definitions into the domain registry (see that file's own comment on
// why this aggregation cannot live in domain/**). This file is the
// platform's single rendering entry point — every page render and every
// isRegisteredComponentType/getComponentDefinition call anywhere in the
// app is downstream of it — so importing it here, once, guarantees the
// registry is populated before anything can query it, without relying on
// import-order side effects scattered across multiple entry points.
import "./definitions";

/**
 * Shared node → component resolution, used by both the top-level
 * PageRenderer and any container component (e.g. SectionNode) that needs
 * to render its own PageNode children.
 *
 * Extracted so there is exactly one place that resolves a node's `type`
 * through the registry and passes `children` down — not duplicated logic
 * in PageRenderer plus a second copy in every container component.
 *
 * Components in the registry receive `props` always, and `children` only
 * when the node actually has any — this keeps leaf components' existing
 * `{ props }`-only signatures valid without a change. `websiteId` is
 * threaded through unconditionally (Phase 3 spec §22) so data-aware
 * components can resolve the correct per-website data source without
 * every non-data component needing to opt in.
 */
export function renderPageNodes(nodes: PageNode[], editMode = false) {
    return nodes.map((node) => (
        <PageNodeRenderer key={node.id} node={node} editMode={editMode} />
    ));
}

export function PageNodeRenderer({
    node,
    editMode = false,
}: {
    node: PageNode;
    editMode?: boolean;
}) {
    // Respect the `visible` prop (spec §41): hidden nodes are suppressed on
    // the public render path. In edit mode we still render them (dimmed) so
    // the editor can toggle visibility back on — suppressing in edit mode
    // would make a hidden component unreachable in the UI.
    const isHidden = node.props.visible === false;
    if (isHidden && !editMode) return null;

    let rendered: React.ReactNode;

    if (!isRegisteredComponentType(node.type)) {
        rendered = <UnknownComponentPlaceholder type={node.type} />;
    } else {
        const Component = componentMap[node.type] as ComponentType<PageComponentProps>;
        rendered = createElement(Component, { props: node.props, editMode }, node.children as never);

        // A data widget (one with an entry in SKELETONS) is an async Server
        // Component that awaits its own fetch. Wrapping just that node in
        // Suspense lets the rest of the page — and every OTHER widget on it —
        // stream in without waiting on the slowest one; without this, one
        // slow data source blocked the entire page. Static components (Hero,
        // Text, layout) render synchronously and need no boundary.
        //
        // Not wrapped in edit mode: the builder canvas measures and outlines
        // nodes by their rendered DOM (use-canvas-hit-testing.ts), and a node
        // that is still suspended has no DOM to measure yet.
        if (!editMode && node.type in skeletonMap) {
            const SkeletonBody = skeletonMap[node.type];
            rendered = <Suspense fallback={<SkeletonBody />}>{rendered}</Suspense>;
        }
    }

    if (!editMode) return rendered;

    return (
        <div
            data-civo-node-id={node.id}
            data-civo-node-type={node.type}
            style={isHidden ? { opacity: 0.35, pointerEvents: "none" } : undefined}
            aria-hidden={isHidden ? true : undefined}
        >
            {rendered}
        </div>
    );
}

/**
 * Rendered when a node's `type` isn't in the registry — e.g. an old
 * PageConfig referencing a component that was later renamed/removed.
 * Fails visibly (so an editor notices) rather than silently, but never
 * attempts to execute or import anything based on the unknown type
 * string.
 */
function UnknownComponentPlaceholder({ type }: { type: string }) {
    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
            <div className="rounded-token border border-dashed border-secondary px-4 py-3 text-sm text-secondary-copy">
                Unbekannte Komponente: <code className="font-mono">{type}</code>
            </div>
        </div>
    );
}
