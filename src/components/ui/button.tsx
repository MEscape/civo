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
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                accent: "bg-accent text-accent-foreground hover:bg-accent/90",
                outline:
                    "border border-border-strong bg-transparent text-copy hover:bg-surface",
                ghost: "bg-transparent text-copy hover:bg-canvas",
            },
            size: {
                sm: "h-8 px-3 rounded-token-sm pointer-coarse:h-11",
                md: "h-10 px-4 rounded-token pointer-coarse:h-11",
                lg: "h-12 px-6 text-base rounded-token",
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
