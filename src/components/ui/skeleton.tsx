import { cn } from "@/lib/utils/cn";
import React from "react";

/**
 * A loading placeholder shaped like the content it stands in for, not a
 * generic spinner: a spinner tells a reader "wait", a skeleton also tells
 * them roughly what is about to appear and where, so the page does not
 * visibly jump once the real content lands.
 *
 * `aria-hidden`: the placeholder carries no information of its own. The
 * Suspense boundary around it should have its own `aria-busy`/`aria-live`
 * region if the wait needs to be announced.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            aria-hidden="true"
            className={cn("animate-pulse rounded-token-sm bg-border", className)}
            {...props}
        />
    );
}
