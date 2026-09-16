import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                primary:
                    "bg-[var(--civo-color-primary)] text-white hover:bg-[var(--civo-color-primary)]/90",
                accent: "bg-[var(--civo-color-accent)] text-white hover:bg-[var(--civo-color-accent)]/90",
                outline:
                    "border border-[var(--civo-color-border)] bg-transparent text-[var(--civo-color-text)] hover:bg-[var(--civo-color-surface)]",
                ghost: "bg-transparent text-[var(--civo-color-text)] hover:bg-black/5",
            },
            size: {
                sm: "h-8 px-3 rounded-[calc(var(--civo-radius)_-_2px)]",
                md: "h-10 px-4 rounded-[var(--civo-radius)]",
                lg: "h-12 px-6 text-base rounded-[var(--civo-radius)]",
            },
        },
        defaultVariants: { variant: "primary", size: "md" },
    }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
