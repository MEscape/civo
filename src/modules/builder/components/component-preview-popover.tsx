"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { getComponentDefinition } from "@/modules/component-platform/domain/registry";
import { useComponentPreview } from "./use-component-preview";
import "./component-preview-popover.css";

type ComponentPreviewPopoverProps = {
    hoveredType: string | null;
    anchorRect: DOMRect | null;
    websiteId?: string;
    theme?: WebsiteTheme;
};

export function ComponentPreviewPopover({ hoveredType, anchorRect, websiteId, theme }: ComponentPreviewPopoverProps) {
    const { node, isLoading, error } = useComponentPreview(hoveredType, websiteId);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.4);
    const [height, setHeight] = useState<number | "auto">("auto");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!node || !contentRef.current) return;
        
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const unscaledHeight = entry.contentRect.height;
            const currentScale = 0.4;
            setScale(currentScale);
            setHeight(unscaledHeight * currentScale);
        });
        
        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [node]);

    if (!hoveredType || !anchorRect || !mounted) return null;

    let definition;
    try {
        definition = getComponentDefinition(hoveredType);
    } catch {
        return null;
    }

    const POPOVER_HEIGHT = 250;
    const PADDING = 20;

    let top = anchorRect.top;

    if (top + POPOVER_HEIGHT + PADDING > window.innerHeight) {
        // Doesn't fit downwards, shift it up to align with anchor bottom.
        // Clamp it so it doesn't go off the top of the screen either.
        top = Math.max(PADDING, anchorRect.bottom - POPOVER_HEIGHT);
    }

    const popover = (
        <div 
            className="civo-preview-popover" 
            style={{ 
                position: "fixed",
                top: `${top}px`,
                left: `${anchorRect.right + 10}px`,
            }}
        >
            <div className="civo-preview-popover__header">
                <div className="civo-preview-popover__label">{definition.label}</div>
                {definition.description && (
                    <div className="civo-preview-popover__description">{definition.description}</div>
                )}
            </div>
            
            <div className="civo-preview-popover__stage">
                {isLoading && (
                    <div className="civo-preview-popover__status">
                        Wird gerendert…
                    </div>
                )}
                {error && (
                    <div className="civo-preview-popover__status text-red-700">
                        {error}
                    </div>
                )}
                {!isLoading && !error && node && (
                    <div 
                        className="civo-preview-popover__scale-outer"
                        style={{
                            "--civo-preview-scale": scale,
                            "--civo-preview-height": height === "auto" ? "auto" : `${height}px`,
                        } as React.CSSProperties}
                    >
                        <div className="civo-preview-popover__scale" ref={contentRef}>
                            {theme ? (
                                <ThemeProvider theme={theme}>
                                    {node}
                                </ThemeProvider>
                            ) : (
                                node
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(popover, document.body);
}
