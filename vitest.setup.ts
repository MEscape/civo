import "@testing-library/jest-dom/vitest";

// Registers every feature module's component definitions into the
// component-platform domain registry (component-platform/domain/registry.ts)
// before any test runs. Needed because domain/** test files (e.g.
// builder/domain/drop-placement.test.ts, website/domain/templates/
// templates.test.ts) exercise domain code that queries the registry
// (canInsertChild, getComponentDefinition, …), but domain/** itself must
// stay framework-free and can never import this registration step — see
// component-platform/infrastructure/definitions.ts's own comment. In the
// real app, registration is guaranteed by each route's own imports
// (render-nodes.tsx, website-service.ts, component-palette.tsx); this is
// the equivalent guarantee for the test run as a whole.
import "@/modules/component-platform/infrastructure/definitions";

// jsdom does not implement window.matchMedia, which useMediaQuery (and so the
// builder shell and every animated chart) calls. Real browsers always have it.
// This stub reports "no match" for every query, i.e. the desktop, motion-allowed
// default, and satisfies the addEventListener/removeEventListener contract.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string): MediaQueryList => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {}, // Deprecated but required by TypeScript's MediaQueryList
            removeListener: () => {}, // Deprecated but required
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}
