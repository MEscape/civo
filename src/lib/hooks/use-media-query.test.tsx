import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useMediaQuery } from "./use-media-query";

/** A controllable matchMedia: tests flip `matches` and fire the change event, as a browser would. */
function stubMatchMedia(initial: boolean) {
    const listeners = new Set<() => void>();
    let matches = initial;
    const list = {
        get matches() {
            return matches;
        },
        media: "",
        addEventListener: vi.fn((_: string, l: () => void) => listeners.add(l)),
        removeEventListener: vi.fn((_: string, l: () => void) => listeners.delete(l)),
    };
    const matchMedia = vi.fn(() => list);
    vi.stubGlobal("matchMedia", matchMedia);
    return {
        matchMedia,
        list,
        listeners,
        set(next: boolean) {
            matches = next;
            listeners.forEach((l) => l());
        },
    };
}

afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
    it("returns whether the query currently matches", () => {
        const m = stubMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery("(min-width: 64rem)"));
        expect(result.current).toBe(true);
        expect(m.matchMedia).toHaveBeenCalledWith("(min-width: 64rem)");
    });

    it("re-renders when the query starts or stops matching (window resize, device rotation)", () => {
        const m = stubMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery("(min-width: 64rem)"));
        expect(result.current).toBe(false);
        act(() => m.set(true));
        expect(result.current).toBe(true);
        act(() => m.set(false));
        expect(result.current).toBe(false);
    });

    it("stops listening when the component unmounts, so nothing leaks", () => {
        const m = stubMatchMedia(false);
        const { unmount } = renderHook(() => useMediaQuery("(min-width: 64rem)"));
        expect(m.listeners.size).toBe(1);
        unmount();
        expect(m.listeners.size).toBe(0);
    });

    it("uses the server snapshot during server rendering, where there is no window", () => {
        stubMatchMedia(false); // the real browser value must NOT be consulted on the server
        function Probe({ server }: { server?: boolean }) {
            const matches = useMediaQuery("(min-width: 64rem)", server);
            return <span>{matches ? "desktop" : "mobile"}</span>;
        }
        expect(renderToString(<Probe />)).toContain("mobile");
        expect(renderToString(<Probe server />)).toContain("desktop");
    });
});
