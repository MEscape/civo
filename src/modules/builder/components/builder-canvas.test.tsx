import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import documentReducer from "@/modules/builder/application/document-slice";
import uiReducer from "@/modules/builder/application/ui-slice";
import saveStateReducer from "@/modules/builder/application/save-state-slice";
import { BuilderCanvas } from "@/modules/builder/components/builder-canvas";
import type { PageNode } from "@/modules/builder/domain/page-node";
import type { useCanvasDnd } from "@/modules/builder/components/use-canvas-dnd";

/**
 * Regression test for the selection-overlay resize bug: switching the
 * builder's viewport (desktop/tablet/mobile) visually resizes the canvas,
 * but the selection/hover overlay box was left at its pre-resize
 * coordinates because the effects measuring it never re-ran on a
 * `viewport` change, and — once that dependency was added — because the
 * canvas width change animates over 150ms (`transition-[max-width]`), so
 * measuring the instant `viewport` changes still captured stale,
 * mid-animation geometry. See builder-canvas.tsx's effects for the fix
 * (viewport dependency + a `transitionend` re-measure).
 */

// renderCanvasAction is a Server Action; mock it to resolve synchronously
// with real markup carrying data-civo-node-id, exactly like the real
// component registry's render-nodes.tsx does for editMode.
vi.mock("@/modules/builder/application/canvas-render-action", async () => {
    const React = await import("react");
    return {
        renderCanvasAction: vi.fn(async () => ({
            ok: true,
            node: React.createElement("div", { "data-civo-node-id": "hero-1", "data-testid": "hero-1" }, "Hero"),
        })),
    };
});

function makeStore() {
    return configureStore({
        reducer: { document: documentReducer, ui: uiReducer, saveState: saveStateReducer },
    });
}

function makeDnd(): ReturnType<typeof useCanvasDnd> {
    return {
        activeSource: null,
        dropTarget: null,
        dropIndicatorRect: null,
        keyboardActive: false,
        handleGripKeyDown: vi.fn(),
        beginPaletteDrag: vi.fn(),
        updatePaletteDragPosition: vi.fn(),
        endDrag: vi.fn(),
        cancelDrag: vi.fn(),
    };
}

const nodes: PageNode[] = [{ id: "hero-1", type: "hero", props: {} }];

let widthPhase: "desktop" | "tablet" = "desktop";

function mockRect(width: number): DOMRect {
    return {
        top: 0,
        left: 0,
        bottom: 50,
        right: width,
        width,
        height: 50,
        x: 0,
        y: 0,
        toJSON() {
            return this;
        },
    } as DOMRect;
}

afterEach(() => {
    vi.restoreAllMocks();
    widthPhase = "desktop";
});

describe("BuilderCanvas selection overlay tracks viewport resize", () => {
    it("re-measures the selected node's rect when viewport changes, and again once the resize transition finishes", async () => {
        // Simulate a real layout change: the canvas (and its hero child)
        // is "wider" at desktop than at tablet, exactly as it would be
        // after the container's max-width transition actually settles.
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() =>
            mockRect(widthPhase === "desktop" ? 1000 : 400)
        );

        const containerRef = { current: null as HTMLDivElement | null };

        const { rerender } = render(
            <Provider store={makeStore()}>
                <BuilderCanvas
                    nodes={nodes}
                    selectedNodeId="hero-1"
                    onSelect={() => {}}
                    viewport="desktop"
                    containerRef={containerRef as React.RefObject<HTMLDivElement | null>}
                    dnd={makeDnd()}
                />
            </Provider>
        );

        // Wait for the debounced renderCanvasAction to resolve and the
        // hero node to actually be in the DOM.
        await screen.findByTestId("hero-1", {}, { timeout: 3000 });

        const getOverlayWidth = () => {
            const overlay = document.querySelector(".civo-canvas-overlay > div[style*='left']") as HTMLElement | null;
            return overlay?.style.width;
        };

        expect(getOverlayWidth()).toBe("1000px");

        // Switch to tablet: the underlying layout is now narrower (as it
        // would be once the browser reflows for the new max-width).
        widthPhase = "tablet";
        act(() => {
            rerender(
                <Provider store={makeStore()}>
                    <BuilderCanvas
                        nodes={nodes}
                        selectedNodeId="hero-1"
                        onSelect={() => {}}
                        viewport="tablet"
                        containerRef={containerRef as React.RefObject<HTMLDivElement | null>}
                        dnd={makeDnd()}
                    />
                </Provider>
            );
        });

        // The `viewport`-keyed effect re-measures immediately on the prop
        // change — this is the primary fix (previously stayed 1000px).
        expect(getOverlayWidth()).toBe("400px");

        // Now simulate the animation actually completing: fire
        // `transitionend` on the measured container, as the real
        // max-width transition would once settled. This exercises the
        // second half of the fix — the safety net for the animated case.
        act(() => {
            const container = document.querySelector(".civo-canvas-content") as HTMLElement;
            const event = new Event("transitionend", { bubbles: true }) as TransitionEvent & {
                propertyName: string;
            };
            Object.defineProperty(event, "propertyName", { value: "max-width" });
            container.dispatchEvent(event);
        });

        expect(getOverlayWidth()).toBe("400px");
    });
});
