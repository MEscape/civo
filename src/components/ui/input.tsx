import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared chrome for every text-entry control. Uses --civo-color-border-strong
 * (not the decorative --civo-color-border) so the control's boundary meets
 * WCAG 1.4.11 (3:1). Focus is left to the global :focus-visible outline in
 * globals.css; never suppress it here.
 */
const controlBase =
    "w-full rounded-token-sm border border-border-strong bg-surface px-3 text-sm text-copy placeholder:text-copy-muted disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(controlBase, "h-9", className)}
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
        className={cn(controlBase, "min-h-20 py-2", className)}
        {...props}
    />
));
Textarea.displayName = "Textarea";


/**
 * Native <select>. Deliberately not a Radix Select: these are plain form
 * choices, and the native element gives mobile pickers, type-to-select and
 * full keyboard/screen-reader behavior with no client JavaScript.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, ...props }, ref) => (
        <select ref={ref} className={cn(controlBase, "h-9 py-1", className)} {...props} />
    )
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label
            className={cn("text-xs font-medium text-copy-muted", className)}
            {...props}
        />
    );
}
