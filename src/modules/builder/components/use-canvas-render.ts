"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { renderCanvasAction } from "@/modules/builder/application/canvas-render-action";

/**
 * Debounce-renders the draft tree by calling the `renderCanvasAction`
 * Server Action whenever it changes, receiving back a real React element
 * tree (not an HTML string — see canvas-render-action.ts for why).
 * Debounced so rapid property edits (typing in a text field) don't
 * trigger a server round-trip per keystroke (spec §20).
 *
 * `websiteId` is forwarded so data-aware components preview against this
 * website's own configured data source (spec §30).
 */
export function useCanvasRender(children: PageNode[], websiteId?: string, debounceMs = 250) {
    const [node, setNode] = useState<ReactNode>(null);
    const [isRendering, setIsRendering] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const requestId = ++requestIdRef.current;
            setIsRendering(true);

            renderCanvasAction({ type: "page", children }, websiteId)
                .then((result) => {
                    if (requestId !== requestIdRef.current) return; // stale response, ignore
                    setIsRendering(false);
                    if (result.ok) {
                        setNode(result.node);
                        setError(null);
                    } else {
                        setError(result.message);
                    }
                })
                .catch(() => {
                    if (requestId !== requestIdRef.current) return;
                    setIsRendering(false);
                    setError("Die Vorschau konnte nicht geladen werden.");
                });
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [children, websiteId, debounceMs]);

    return { node, isRendering, error };
}
