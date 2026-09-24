import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import documentReducer from "@/modules/builder/application/document-slice";
import uiReducer from "@/modules/builder/application/ui-slice";
import saveStateReducer from "@/modules/builder/application/save-state-slice";
import { BuilderCanvas } from "@/modules/builder/components/builder-canvas";
import type { PageNode } from "@/modules/builder/domain/page-node";
import type { useCanvasDnd } from "@/modules/builder/components/use-canvas-dnd";

/**
 * Regression tests for the selection-overlay resize bug: switching the
 * builder's viewport (desktop/tablet/mobile) visually resizes the canvas,
 * but the selection/hover overlay box was left at its pre-resize
 * coordinates. Two causes, two tests:
 *  1. the measuring effects did not depend on `viewport`;
 *  2. the width change animates over 150ms (`transition-[max-width]`), so
 *     measuring the instant `viewport` changes captures mid-animation
 *     geometry. builder-canvas.tsx therefore also re-measures whenever
 *     the canvas content resizes, using a ResizeObserver.
 *
 * Why not `transitionend`, which this file used to simulate: that event
 * fires on the element that transitions and bubbles UP to its ancestors.
 * The measured container is a DESCENDANT of the transitioning element, so it
 * never receives it in a browser. The old test passed only because it
 * dispatched the event straight onto the container, which no browser does.
 */

// renderCanvasAction is a Server Action; mock it to resolve synchronously
// with real markup carrying data-civo-node-id, exactly like the real
// component registry's render-nodes.tsx does for editMode.
vi.mock("@/modules/builder/application/canvas-render-action", async () => {
    const React = await import("react");
    return {
        renderCanvasAction: vi.fn(async () => ({
            ok: true,
            data: React.createElement("div", { "data-civo-node-id": "hero-1", "data-testid": "hero-1" }, "Hero"),
        })),
    };
});

/**
 * jsdom has no layout, so it never reports resizes. This stand-in records
 * every observer so a test can play the browser's part: change the geometry,
 * then call `resizeObservers.notify()` exactly as a real ResizeObserver would.
 */
const resizeObservers = {
    instances: [] as Array<{ callback: ResizeObserverCallback; targets: Set<Element> }>,
    notify() {
        for (const { callback, targets } of this.instances) {
            callback([...targets].map((target) => ({ target }) as ResizeObserverEntry), {} as ResizeObserver);
        }
    },
};

class FakeResizeObserver {
    private record: { callback: ResizeObserverCallback; targets: Set<Element> };
    constructor(callback: ResizeObserverCallback) {
        this.record = { callback, targets: new Set() };
        resizeObservers.instances.push(this.record);
    }
    observe(target: Element) {
        this.record.targets.add(target);
    }
    unobserve(target: Element) {
        this.record.targets.delete(target);
    }
    disconnect() {
        this.record.targets.clear();
        resizeObservers.instances = resizeObservers.instances.filter((r) => r !== this.record);
    }
}

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

beforeEach(() => {
    resizeObservers.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

        // The rect is measured in an effect AFTER the async render lands, so the
        // hero being in the DOM does not yet mean the overlay is drawn: wait for it.
        await waitFor(() => expect(getOverlayWidth()).toBe("1000px"));

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

        // Still at 400px here in this test, but a real max-width transition changes
        // the layout AFTER the prop change. Play the browser's part: the geometry
        // moves on (widthPhase), and the ResizeObserver reports it.
        widthPhase = "desktop";
        act(() => resizeObservers.notify());
        expect(getOverlayWidth(), "a resize of the canvas content must re-measure").toBe("1000px");

        widthPhase = "tablet";
        act(() => resizeObservers.notify());
        expect(getOverlayWidth()).toBe("400px");
    });

    it("observes the canvas content for the whole time it is mounted, and stops when unmounted", async () => {
        const containerRef = { current: null as HTMLDivElement | null };
        const { unmount } = render(
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
        await screen.findByTestId("hero-1", {}, { timeout: 3000 });

        const observed = resizeObservers.instances.flatMap((r) => [...r.targets]);
        expect(observed).toContain(document.querySelector(".civo-canvas-content"));

        unmount();
        expect(resizeObservers.instances.flatMap((r) => [...r.targets])).toEqual([]);
    });
});
