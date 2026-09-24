import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "./metric-card";

const NBSP = "\u00a0";

describe("MetricCard", () => {
    it("shows label, value and unit", () => {
        render(<MetricCard metric={{ id: "k", label: "Radverkehrsanteil", value: 27, unit: "%" }} />);
        expect(screen.getByText("Radverkehrsanteil")).toBeInTheDocument();
        expect(screen.getByText("27")).toBeInTheDocument();
        expect(screen.getByText("%")).toBeInTheDocument();
    });

    it("writes the direction of change in text, so it is not conveyed by the arrow alone", () => {
        const { container } = render(
            <MetricCard metric={{ id: "k", label: "Energieverbrauch", value: 5, trend: "down", changePercent: 6.8 }} />,
        );
        // Announced as "Veränderung: −6,8 %": sign and size both present as text.
        expect(container.textContent).toContain(`Veränderung: \u22126,8${NBSP}%`);
        // The arrow itself is decorative.
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("renders nothing for the change when the metric has no trend or no change value", () => {
        const { container, rerender } = render(<MetricCard metric={{ id: "k", label: "A", value: 1, trend: "up" }} />);
        expect(container.textContent).not.toContain("Veränderung");
        rerender(<MetricCard metric={{ id: "k", label: "A", value: 1, changePercent: 3 }} />);
        expect(container.textContent).not.toContain("Veränderung");
    });

    it("does not show '0' or a stray change for a metric whose change is exactly 0", () => {
        const { container } = render(<MetricCard metric={{ id: "k", label: "A", value: 1, trend: "flat", changePercent: 0 }} />);
        expect(container.textContent).toContain(`\u00b10${NBSP}%`);
    });

    it("supports a compact size for dense dashboards", () => {
        const { container } = render(<MetricCard size="md" metric={{ id: "k", label: "A", value: 3 }} />);
        expect(container.querySelector(".text-2xl")).not.toBeNull();
        expect(container.querySelector(".text-3xl")).toBeNull();
    });
});
