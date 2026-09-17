"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { renderCanvasAction } from "@/modules/builder/application/canvas-render-action";
import { getComponentDefinition } from "@/modules/component-platform/domain/registry";

const HOVER_INTENT_MS = 300;

type PreviewState = {
    node: ReactNode;
    isLoading: boolean;
    error: string | null;
};

const emptyState: PreviewState = { node: null, isLoading: false, error: null };

/**
 * Renders a live, on-demand preview of a single component type for the
 * palette's hover card (see component-preview-popover.tsx).
 *
 * Reuses `renderCanvasAction` — the SAME Server Action `PreviewCanvas`
 * uses for the main builder preview — with a one-node PageConfig built
 * from the component's own `createDefaultNode()`. This is deliberate:
 * every registered component already ships realistic example props for
 * exactly this purpose (it's what the palette's "click to insert" path
 * also uses), and going through the real render pipeline means data-aware
 * async Server Components (NewsGrid, MetricChart, ...) preview with real
 * (mock/per-website) data instead of needing a second, fake rendering
 * path just for hover cards.
 *
 * Two caches keep this cheap even though a dev may sweep across a dozen
 * palette entries in a couple of seconds:
 *  - A hover-intent delay (HOVER_INTENT_MS) so merely passing over an
 *    item doesn't trigger a server round-trip.
 *  - A per-session, per-type result cache (module-level `previewCache`)
 *    so re-hovering something already seen is instant and never
 *    re-fetches — a component's default preview never changes at
 *    runtime, so there's no invalidation to worry about.
 */
const previewCache = new Map<string, ReactNode>();

export function useComponentPreview(hoveredType: string | null, websiteId?: string) {
    const [state, setState] = useState<PreviewState>(emptyState);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!hoveredType) {
            setState(emptyState);
            return;
        }

        const cached = previewCache.get(hoveredType);
        if (cached !== undefined) {
            setState({ node: cached, isLoading: false, error: null });
            return;
        }

        const requestId = ++requestIdRef.current;
        const timeout = setTimeout(() => {
            setState({ node: null, isLoading: true, error: null });

            let defaultNode;
            try {
                defaultNode = getComponentDefinition(hoveredType).createDefaultNode();
            } catch {
                if (requestId !== requestIdRef.current) return;
                setState({ node: null, isLoading: false, error: "Unbekannte Komponente." });
                return;
            }

            renderCanvasAction({ type: "page", children: [defaultNode] }, websiteId)
                .then((result) => {
                    if (requestId !== requestIdRef.current) return; // stale — hover moved on
                    if (result.ok) {
                        previewCache.set(hoveredType, result.node);
                        setState({ node: result.node, isLoading: false, error: null });
                    } else {
                        setState({ node: null, isLoading: false, error: result.message });
                    }
                })
                .catch(() => {
                    if (requestId !== requestIdRef.current) return;
                    setState({ node: null, isLoading: false, error: "Vorschau konnte nicht geladen werden." });
                });
        }, HOVER_INTENT_MS);

        return () => clearTimeout(timeout);
    }, [hoveredType, websiteId]);

    return state;
}
