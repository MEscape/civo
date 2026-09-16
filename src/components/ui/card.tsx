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
                "border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] rounded-[var(--civo-radius)]",
                className
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={cn("font-[family-name:var(--civo-font-heading)] text-lg leading-snug", className)}
            {...props}
        />
    );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-sm text-[var(--civo-color-text-muted)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-5 pt-0 flex items-center", className)} {...props} />;
}
