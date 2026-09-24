import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Section — the vertical rhythm unit of every public page. Spacing comes
 * from the theme's --civo-section-spacing variable, never a one-off
 * value, so a municipality's spacing preference applies uniformly (spec
 * §25: controlled spacing tokens, not arbitrary pixels).
 */
export function Section({
                            className,
                            tone = "default",
                            ...props
                        }: React.HTMLAttributes<HTMLElement> & { tone?: "default" | "muted" }) {
    return (
        <section
            className={cn(
                tone === "muted" && "bg-surface",
                className
            )}
            style={{ paddingBlock: "var(--civo-section-spacing)" }}
            {...props}
        />
    );
}

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("mx-auto w-full max-w-6xl px-6", className)} {...props} />;
}

const columnClasses: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 @2xl:grid-cols-2",
    3: "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3",
    4: "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-4",
};

/**
 * Grid — accepts a controlled `columns` option (1–4) rather than an
 * arbitrary CSS grid-template-columns value, keeping the builder's
 * "columns" property simple and safe. Breakpoints are container variants
 * (see ThemeProvider): the column count follows the page frame's width, so
 * the builder's tablet/mobile preview shows what a real device would.
 */
export function Grid({
                         columns = 3,
                         className,
                         ...props
                     }: React.HTMLAttributes<HTMLDivElement> & { columns?: 1 | 2 | 3 | 4 }) {
    return <div className={cn("grid gap-6", columnClasses[columns] ?? columnClasses[3], className)} {...props} />;
}

export function SectionHeading({
                                   children,
                                   className,
                               }: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <h2
            className={cn(
                "mb-8 text-2xl font-heading text-copy",
                className
            )}
        >
            {children}
        </h2>
    );
}
