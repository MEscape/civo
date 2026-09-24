"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Sheet: a panel that slides in from the screen edge over the page. Built on
 * Radix Dialog, so it is modal, traps focus, closes on Escape, restores
 * focus to its trigger and labels itself from SheetTitle. Every Sheet must
 * render a SheetTitle (use `className="sr-only"` if the design shows its own
 * heading) or Radix warns and screen readers get an unnamed dialog.
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const sheetVariants = cva(
    // 5/6 of the screen up to max-w-xs: a sliver of the page stays visible on
    // phones so the sheet reads as an overlay you can tap out of.
    "fixed inset-y-0 z-50 flex w-5/6 max-w-xs flex-col overflow-y-auto border-border bg-surface",
    {
        variants: {
            side: {
                left: "left-0 border-r animate-sheet-left",
                right: "right-0 border-l animate-sheet-right",
            },
        },
        defaultVariants: { side: "left" },
    },
);

function SheetContent({
    side,
    container,
    className,
    children,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants> & {
        /**
         * Where to mount the sheet. Defaults to document.body, which is OUTSIDE
         * any layout wrapper that sets CSS variables (the dashboard layout
         * swaps the heading/body fonts that way). Pass an element inside that
         * wrapper so the sheet inherits the same tokens as the page under it.
         */
        container?: HTMLElement | null;
    }) {
    // Radix restores focus only to a <SheetTrigger>. Sheets here are usually
    // opened by a button elsewhere, so remember whatever had focus at open
    // and give it back on close (WCAG 2.4.3).
    const openerRef = React.useRef<HTMLElement | null>(null);

    return (
        <DialogPrimitive.Portal container={container}>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-copy/40 animate-sheet-overlay" />
            <DialogPrimitive.Content
                data-slot="sheet-content"
                // Content is described by its own visible text; opt out of the
                // Description requirement rather than adding a redundant one.
                aria-describedby={undefined}
                className={cn(sheetVariants({ side }), className)}
                // Focus the panel itself, not its first field: on a phone the
                // first field would raise the keyboard over half the screen.
                onOpenAutoFocus={(event) => {
                    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    event.preventDefault();
                    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    openerRef.current?.focus();
                }}
                {...props}
            >
                {children}
                <DialogPrimitive.Close
                    className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-token-sm text-copy-muted hover:bg-canvas hover:text-copy pointer-coarse:size-11"
                >
                    <X className="size-4" />
                    <span className="sr-only">Schließen</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
