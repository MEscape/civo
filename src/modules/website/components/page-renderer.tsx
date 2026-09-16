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
 *
 * `websiteId` (spec §22) is passed through to every rendered component so
 * data-aware ones (NewsGrid, EventsGrid, ...) resolve this website's own
 * configured data source rather than a single hardcoded global provider.
 */
export function PageRenderer({ config, websiteId }: { config: PageConfig; websiteId?: string }) {
    return <>{renderPageNodes(config.children, false, websiteId)}</>;
}
