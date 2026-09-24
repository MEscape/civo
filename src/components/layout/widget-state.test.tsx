import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetState } from "./widget-state";

describe("WidgetState", () => {
    it("explains an error in plain words and keeps the section heading in place", () => {
        render(<WidgetState kind="error" heading="Stadt in Zahlen" />);
        expect(screen.getByText("Stadt in Zahlen")).toBeInTheDocument();
        expect(screen.getByText(/derzeit nicht verfügbar/i)).toBeInTheDocument();
    });

    it("says there is no data for the empty case, with different wording than an error", () => {
        render(<WidgetState kind="empty" heading="Verteilung" />);
        expect(screen.getByText(/keine Daten vor/i)).toBeInTheDocument();
        expect(screen.queryByText(/nicht verfügbar/i)).not.toBeInTheDocument();
    });

    it("exposes its kind for the builder and tests, and works without a heading", () => {
        const { container } = render(<WidgetState kind="error" />);
        expect(container.querySelector('[data-widget-state="error"]')).not.toBeNull();
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });

    it("never leaks technical detail: no stack, no 'error' word, no status codes", () => {
        const { container } = render(<WidgetState kind="error" />);
        expect(container.textContent).not.toMatch(/exception|stack|500|undefined|null|error/i);
    });

    it("decorative icon is hidden from assistive tech; meaning lives in the text", () => {
        const { container } = render(<WidgetState kind="error" />);
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });
});
