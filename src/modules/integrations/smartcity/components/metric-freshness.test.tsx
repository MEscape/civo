import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MetricFreshness } from "./metric-freshness";

const m = (extra: object) => ({ id: "k", label: "L", value: 1, ...extra });

describe("MetricFreshness", () => {
    it("renders nothing when no metric says anything about its age or source (never implies 'current')", () => {
        const { container } = render(<MetricFreshness metrics={[m({}), m({})]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for an empty list", () => {
        const { container } = render(<MetricFreshness metrics={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows date and source, with a machine-readable <time>", () => {
        const { container } = render(<MetricFreshness metrics={[m({ updatedAt: "2024-01-31", source: "Stadtwerke" })]} />);
        expect(container.textContent).toBe("Stand: 31. Januar 2024 · Quelle: Stadtwerke");
        expect(container.querySelector("time")).toHaveAttribute("datetime", "2024-01-31");
    });

    it("uses the OLDEST timestamp when a widget mixes metrics, and lists each source once", () => {
        const { container } = render(
            <MetricFreshness
                metrics={[
                    m({ updatedAt: "2026-03-14T09:30:00+01:00", source: "A" }),
                    m({ updatedAt: "2026-01-02", source: "B" }),
                    m({ source: "A" }),
                ]}
            />,
        );
        expect(container.textContent).toBe("Stand: 2. Januar 2026 · Quelle: A, B");
    });

    it("shows a source alone, or a date alone, without a dangling separator", () => {
        const a = render(<MetricFreshness metrics={[m({ source: "Nur Quelle" })]} />);
        expect(a.container.textContent).toBe("Quelle: Nur Quelle");
        const b = render(<MetricFreshness metrics={[m({ updatedAt: "2024-01-31" })]} />);
        expect(b.container.textContent).toBe("Stand: 31. Januar 2024");
    });

    it("skips a malformed timestamp instead of printing 'Invalid Date'", () => {
        const { container } = render(<MetricFreshness metrics={[m({ updatedAt: "garbage", source: "S" })]} />);
        expect(container.textContent).toBe("Quelle: S");
    });
});
