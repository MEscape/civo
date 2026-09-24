import { useMediaQuery } from "./use-media-query";

/**
 * True when the user asked the OS to reduce motion. CSS handles CSS
 * animations (globals.css); this exists for JavaScript-driven ones, such as
 * chart entry animations, that the CSS rule cannot reach.
 */
export function usePrefersReducedMotion(): boolean {
    return useMediaQuery("(prefers-reduced-motion: reduce)");
}
