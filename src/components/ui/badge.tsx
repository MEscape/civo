import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Badge. Variants are named for meaning, not appearance:
 *  - default / muted: neutral labels (category, department, party)
 *  - success / warning / danger / info: status. A status badge must carry
 *    its meaning in text (and optionally an icon child), never in color
 *    alone (WCAG 1.4.1) — color only reinforces what the label says.
 */
const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary text-primary-foreground",
                muted: "border-border bg-canvas text-copy-muted",
                success: "border-success-border bg-success-subtle text-success",
                warning: "border-warning-border bg-warning-subtle text-warning",
                danger: "border-danger-border bg-danger-subtle text-danger",
                info: "border-info-border bg-info-subtle text-info",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

function Badge({
    className,
    variant,
    asChild = false,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : "span";

    return (
        <Comp
            data-slot="badge"
            data-variant={variant ?? "default"}
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
