import React, { createElement, type ComponentType } from "react";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { type PageComponentProps, isRegisteredComponentType } from "@/modules/component-platform/domain";
import { componentMap } from "./registry";

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
 * `{ props }`-only signatures valid without a change.
 */
export function renderPageNodes(nodes: PageNode[], editMode = false) {
    return nodes.map((node) => (
        <PageNodeRenderer key={node.id} node={node} editMode={editMode} />
    ));
}

export function PageNodeRenderer({ node, editMode = false }: { node: PageNode; editMode?: boolean }) {
    let rendered: React.ReactNode;

    if (!isRegisteredComponentType(node.type)) {
        rendered = <UnknownComponentPlaceholder type={node.type} />;
    } else {
        const Component = componentMap[node.type] as ComponentType<PageComponentProps>;
        rendered = createElement(Component, { props: node.props, editMode }, node.children as never);
    }

    if (!editMode) return rendered;

    return (
        <div data-civo-node-id={node.id} data-civo-node-type={node.type}>
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
            <div className="rounded-[var(--civo-radius)] border border-dashed border-[var(--civo-color-secondary)] px-4 py-3 text-sm text-[var(--civo-color-secondary)]">
                Unbekannte Komponente: <code className="font-mono">{type}</code>
            </div>
        </div>
    );
}
