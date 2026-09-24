import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Card primitive. Deliberately flat — a hairline border, no drop shadow,
 * minimal radius — per the design brief (spec §8: avoid "excessive
 * shadows", "startup-style neon UI"). This is the base every civic
 * component (NewsGrid, ServiceGrid, ContactCard, ...) builds on.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "border border-border bg-surface rounded-token",
                className
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pb-3", className)} {...props} />;
}

/**
 * Card heading. Defaults to <h3>, correct on pages where cards sit under a
 * section's <h2> (every public page). Pass `as="h2"` where cards sit directly
 * under the page's <h1>, so the outline never skips a level (WCAG 1.3.1).
 */
export function CardTitle({
    as: Heading = "h3",
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
    return <Heading className={cn("font-heading text-lg leading-snug", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-sm text-copy-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pt-0 flex items-center", className)} {...props} />;
}
