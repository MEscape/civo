import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

/**
 * Mirrors how the builder uses Sheet: opened by a plain button that lives
 * OUTSIDE the sheet (not a SheetTrigger), so focus restoration is our code,
 * not Radix's.
 */
function Harness({ side, container }: { side?: "left" | "right"; container?: HTMLElement | null }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>Öffnen</button>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side={side} container={container}>
                    <SheetTitle>Komponenten</SheetTitle>
                    <input aria-label="Erstes Feld" />
                    <button>Einfügen</button>
                </SheetContent>
            </Sheet>
        </>
    );
}

describe("Sheet", () => {
    it("is a modal dialog named by its SheetTitle", async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        expect(await screen.findByRole("dialog", { name: "Komponenten" })).toBeInTheDocument();
    });

    it("focuses the panel itself, not its first field: on a phone the first field would raise the keyboard", async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        const dialog = await screen.findByRole("dialog");
        await waitFor(() => expect(dialog).toHaveFocus());
        expect(screen.getByLabelText("Erstes Feld")).not.toHaveFocus();
    });

    it("closes on Escape and gives focus back to whatever opened it (WCAG 2.4.3), even a non-trigger button", async () => {
        render(<Harness />);
        const opener = screen.getByRole("button", { name: "Öffnen" });
        opener.focus();
        fireEvent.click(opener);
        await screen.findByRole("dialog");
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(opener).toHaveFocus();
    });

    it("has a labelled close button for touch and screen-reader users", async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        const close = await screen.findByRole("button", { name: "Schließen" });
        fireEvent.click(close);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("is modal: content outside the sheet is hidden from assistive technology while it is open", async () => {
        render(<Harness />);
        expect(screen.getByRole("button", { name: "Öffnen" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        await screen.findByRole("dialog");
        // Radix marks everything outside aria-hidden, which is what stops a screen
        // reader wandering onto the page behind the overlay.
        expect(screen.queryByRole("button", { name: "Öffnen" })).not.toBeInTheDocument();
        // ...and inside the sheet stays reachable.
        expect(screen.getByRole("button", { name: "Einfügen" })).toBeInTheDocument();
    });

    it("slides in from the requested edge", async () => {
        const { unmount } = render(<Harness side="right" />);
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        expect((await screen.findByRole("dialog")).className).toContain("right-0");
        unmount();

        render(<Harness side="left" />);
        fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
        expect((await screen.findByRole("dialog")).className).toContain("left-0");
    });

    it("mounts inside a given container, so it inherits that subtree's CSS variables (fonts, themes)", async () => {
        const host = document.createElement("div");
        host.setAttribute("data-testid", "host");
        document.body.appendChild(host);
        try {
            render(<Harness container={host} />);
            fireEvent.click(screen.getByRole("button", { name: "Öffnen" }));
            const dialog = await screen.findByRole("dialog");
            expect(host.contains(dialog)).toBe(true);
        } finally {
            host.remove();
        }
    });
});
