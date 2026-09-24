import type { PageConfig } from "@/modules/builder/domain/page-node";
import { renderPageNodes } from "@/modules/component-platform/infrastructure/render-nodes";

/**
 * Renders a full PageConfig by recursively resolving each PageNode's
 * `type` through the controlled component registry (see render-nodes.tsx
 * for the actual node → component resolution, shared with any container
 * component that needs to render its own PageNode children, e.g.
 * SectionNode).
 *
 * This is a Server Component (no "use client") — the public website
 * render path stays server-compatible. It receives already-validated
 * config (see pageService.getValidatedConfig); it does not re-validate
 * here, to keep this component a pure rendering concern.
 */
export function PageRenderer({ config }: { config: PageConfig }) {
    return <>{renderPageNodes(config.children, false)}</>;
}
