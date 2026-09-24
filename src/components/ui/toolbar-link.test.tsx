import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolbarLink } from "./toolbar-link";

describe("ToolbarLink", () => {
    it("is named by its label even though the label is visually hidden below xl", () => {
        render(<ToolbarLink href="/websites/1/settings" label="Einstellungen" icon={<svg data-testid="icon" />} />);
        const link = screen.getByRole("link", { name: "Einstellungen" });
        expect(link).toHaveAttribute("href", "/websites/1/settings");
        // Also a tooltip for sighted mouse users when only the icon is showing.
        expect(link).toHaveAttribute("title", "Einstellungen");
        expect(screen.getByTestId("icon")).toBeInTheDocument();
    });

    it("keeps the label in the accessibility tree via sr-only, revealing it visually only from xl", () => {
        render(<ToolbarLink href="/x" label="Einstellungen" icon={null} />);
        const label = screen.getByText("Einstellungen");
        expect(label.className).toContain("sr-only");
        expect(label.className).toContain("xl:not-sr-only");
    });

    it("opens in a new tab AND says so, since a silent tab switch disorients screen-reader users", () => {
        render(<ToolbarLink href="/s/1" label="Öffentliche Seite" icon={null} newTab />);
        const link = screen.getByRole("link", { name: /Öffentliche Seite.*öffnet in neuem Tab/ });
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("does not announce a new tab for an ordinary link", () => {
        render(<ToolbarLink href="/x" label="Einstellungen" icon={null} />);
        const link = screen.getByRole("link");
        expect(link).not.toHaveAttribute("target");
        expect(link.textContent).not.toContain("neuem Tab");
    });

    it("grows to a 44px touch target on coarse pointers", () => {
        render(<ToolbarLink href="/x" label="A" icon={null} />);
        expect(screen.getByRole("link").className).toContain("pointer-coarse:h-11");
    });

    it("merges a caller's className without losing the base styles", () => {
        render(<ToolbarLink href="/x" label="A" icon={null} className="ml-auto" />);
        const cls = screen.getByRole("link").className;
        expect(cls).toContain("ml-auto");
        expect(cls).toContain("inline-flex");
    });
});
