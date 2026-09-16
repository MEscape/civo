"use client";

import type { PageNode } from "@/modules/builder/domain/page-node";
import { useCanvasRender } from "./use-canvas-render";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import type { WebsiteTheme } from "@/modules/website/domain/theme";

type PreviewCanvasProps = {
    nodes: PageNode[];
    viewport: "desktop" | "tablet" | "mobile";
    theme?: WebsiteTheme;
    websiteId?: string;
};

const viewportWidths: Record<PreviewCanvasProps["viewport"], string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "390px",
};

/**
 * Preview mode (Phase 2 spec §25–26): the same server-rendered draft the
 * canvas uses, but with no editor chrome — no selection overlay, no drag
 * handles, no click interception. Conceptually exactly
 * `PageRenderer(currentDraftConfig)` at a controlled viewport width; it
 * does not reimplement rendering, and the underlying component output is
 * identical to both the editor canvas and the public site (all three
 * share render-nodes.tsx / the component registry, and this one shares
 * the exact same renderCanvasAction Server Action as the canvas).
 */
export function PreviewCanvas({ nodes, viewport, theme, websiteId }: PreviewCanvasProps) {
    const { node, isRendering, error } = useCanvasRender(nodes, websiteId);

    if (nodes.length === 0) {
        return (
            <div className="flex h-full min-h-[50vh] items-center justify-center text-[var(--civo-color-text-muted)]">
                <p>Nichts zu sehen — die Seite ist leer.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto transition-[max-width] duration-300" style={{ maxWidth: viewportWidths[viewport] }}>
            <div className="min-h-screen bg-[var(--civo-color-background)] shadow-2xl ring-1 ring-[var(--civo-color-border)]">
                {theme ? (
                    <ThemeProvider theme={theme}>
                        {node}
                    </ThemeProvider>
                ) : (
                    node
                )}
            </div>

            {isRendering && !node && (
                <p className="mt-4 text-center text-sm text-[var(--civo-color-text-muted)]">Wird gerendert…</p>
            )}
            {error && <p className="mt-4 text-center text-sm text-red-700">{error}</p>}
        </div>
    );
}
