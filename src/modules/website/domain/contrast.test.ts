import { describe, it, expect } from "vitest";
import {
    relativeLuminance,
    contrastRatio,
    readableForeground,
    ensureContrast,
    LIGHT_FOREGROUND,
    DARK_FOREGROUND,
    PAGE_BACKGROUND,
} from "./contrast";

describe("relativeLuminance", () => {
    it("is 0 for black and 1 for white", () => {
        expect(relativeLuminance("#000000")).toBe(0);
        expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    });

    it("is case-insensitive", () => {
        expect(relativeLuminance("#C9782F")).toBe(relativeLuminance("#c9782f"));
    });

    it("rejects anything that is not #rrggbb", () => {
        for (const bad of ["red", "#fff", "#12345", "#gggggg", "rgb(0,0,0)", "", "#1234567"]) {
            expect(() => relativeLuminance(bad), bad).toThrow();
        }
    });
});

describe("contrastRatio", () => {
    it("is 21:1 for black on white, in either order", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
        expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    });

    it("is 1:1 for identical colors", () => {
        expect(contrastRatio("#7a8b85", "#7a8b85")).toBeCloseTo(1, 10);
    });

    it("matches independently known WCAG figures", () => {
        // Reference values computed with the WCAG 2.x formula.
        expect(contrastRatio("#ffffff", "#c9782f")).toBeCloseTo(3.38, 2);
        expect(contrastRatio("#ffffff", "#00e5ff")).toBeCloseTo(1.54, 2);
        expect(contrastRatio("#ffffff", "#1f3a34")).toBeCloseTo(12.26, 2);
    });
});

describe("readableForeground", () => {
    it("picks white on dark backgrounds", () => {
        expect(readableForeground("#1a1a1a")).toBe(LIGHT_FOREGROUND);
        expect(readableForeground("#1f3a34")).toBe(LIGHT_FOREGROUND);
        expect(readableForeground("#024b6d")).toBe(LIGHT_FOREGROUND);
    });

    it("picks black on light backgrounds, including the seeded accents that fail with white", () => {
        expect(readableForeground("#00e5ff")).toBe(DARK_FOREGROUND); // white is 1.54:1
        expect(readableForeground("#f39c12")).toBe(DARK_FOREGROUND);
        expect(readableForeground("#f2a900")).toBe(DARK_FOREGROUND);
        expect(readableForeground("#c9782f")).toBe(DARK_FOREGROUND); // white is 3.38:1
    });

    it("falls back to white for an unparseable color instead of throwing", () => {
        // A bad value in stored theme data must not take the whole page down.
        expect(readableForeground("not-a-color")).toBe(LIGHT_FOREGROUND);
        expect(readableForeground("")).toBe(LIGHT_FOREGROUND);
    });

    it("meets WCAG AA (4.5:1) for EVERY color, not just the ones we thought of", () => {
        // Sweep the RGB cube on a 17-step grid per channel (4,913 colors,
        // including the mid-luminance band where a near-black option would
        // dip below 4.5). This is why the dark foreground is pure black.
        const steps = Array.from({ length: 17 }, (_, i) => Math.min(255, i * 16));
        const hex = (n: number) => n.toString(16).padStart(2, "0");
        let worst = Infinity;
        let worstColor = "";
        for (const r of steps) {
            for (const g of steps) {
                for (const b of steps) {
                    const bg = `#${hex(r)}${hex(g)}${hex(b)}`;
                    const ratio = contrastRatio(readableForeground(bg), bg);
                    if (ratio < worst) {
                        worst = ratio;
                        worstColor = bg;
                    }
                }
            }
        }
        expect(worst, `worst color ${worstColor}`).toBeGreaterThanOrEqual(4.5);
    });
});

describe("ensureContrast", () => {
    it("returns a color unchanged when it already meets the ratio", () => {
        expect(ensureContrast("#1a1a1a", PAGE_BACKGROUND)).toBe("#1a1a1a");
        expect(ensureContrast("#1f3a34", PAGE_BACKGROUND)).toBe("#1f3a34");
    });

    it("darkens a failing color until it meets 4.5:1, and not further than needed", () => {
        for (const failing of ["#00e5ff", "#f39c12", "#f2a900", "#c9782f", "#7a8b85"]) {
            expect(contrastRatio(failing, PAGE_BACKGROUND), failing).toBeLessThan(4.5);
            const fixed = ensureContrast(failing, PAGE_BACKGROUND);
            const ratio = contrastRatio(fixed, PAGE_BACKGROUND);
            expect(ratio, failing).toBeGreaterThanOrEqual(4.5);
            // Minimal change: within one search step (2% toward black) of the threshold.
            expect(ratio, failing).toBeLessThan(5.2);
        }
    });

    it("keeps the hue family: only darkens, never shifts channel ordering", () => {
        const fixed = ensureContrast("#00e5ff", PAGE_BACKGROUND);
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(fixed.slice(i, i + 2), 16));
        expect(r).toBeLessThan(g);
        expect(g).toBeLessThanOrEqual(b);
    });

    it("can reach the ratio for ANY color, including pure white", () => {
        expect(contrastRatio(ensureContrast("#ffffff", PAGE_BACKGROUND), PAGE_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    });

    it("returns an unparseable color unchanged instead of throwing", () => {
        expect(ensureContrast("not-a-color", PAGE_BACKGROUND)).toBe("not-a-color");
        expect(ensureContrast("#12", PAGE_BACKGROUND)).toBe("#12");
    });

    it("meets the ratio across the whole RGB cube (17-step grid)", () => {
        const steps = Array.from({ length: 17 }, (_, i) => Math.min(255, i * 16));
        const hex = (n: number) => n.toString(16).padStart(2, "0");
        let worst = Infinity;
        let worstColor = "";
        for (const r of steps) for (const g of steps) for (const b of steps) {
            const c = `#${hex(r)}${hex(g)}${hex(b)}`;
            const ratio = contrastRatio(ensureContrast(c, PAGE_BACKGROUND), PAGE_BACKGROUND);
            if (ratio < worst) { worst = ratio; worstColor = c; }
        }
        expect(worst, `worst color ${worstColor}`).toBeGreaterThanOrEqual(4.5);
    });
});
