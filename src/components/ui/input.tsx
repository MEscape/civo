import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(
                "h-9 w-full rounded-[calc(var(--civo-radius)_-_2px)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] px-3 text-sm text-[var(--civo-color-text)] placeholder:text-[var(--civo-color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]",
                className
            )}
            {...props}
        />
    )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            "min-h-20 w-full rounded-[calc(var(--civo-radius)_-_2px)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] px-3 py-2 text-sm text-[var(--civo-color-text)] placeholder:text-[var(--civo-color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]",
            className
        )}
        {...props}
    />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label
            className={cn("text-xs font-medium text-[var(--civo-color-text-muted)]", className)}
            {...props}
        />
    );
}
