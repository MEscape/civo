import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
    it("is hidden from assistive tech: it carries no information, only shape", () => {
        const { container } = render(<Skeleton className="h-4 w-24" />);
        expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    });

    it("uses the pulse animation, which globals.css stills for prefers-reduced-motion", () => {
        const { container } = render(<Skeleton />);
        expect(container.firstElementChild!.className).toContain("animate-pulse");
    });

    it("accepts sizing classes so callers can shape it like the content it replaces", () => {
        const { container } = render(<Skeleton className="h-4 w-24 rounded-full" />);
        const cls = container.firstElementChild!.className;
        expect(cls).toContain("h-4");
        expect(cls).toContain("w-24");
    });
});
