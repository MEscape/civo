import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. Built on useSyncExternalStore so it is
 * tear-free and never needs an effect + state pair.
 *
 * `serverSnapshot` is what the server render and the hydration pass see
 * (there is no window on the server). Pick the value whose markup is
 * acceptable as a first paint: React switches to the real value straight
 * after hydration.
 */
export function useMediaQuery(query: string, serverSnapshot = false): boolean {
    return useSyncExternalStore(
        (notify) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", notify);
            return () => list.removeEventListener("change", notify);
        },
        () => window.matchMedia(query).matches,
        () => serverSnapshot,
    );
}
