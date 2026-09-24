import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatDate, formatNumber, formatShare, formatChange } from "./formatters";

describe("formatRelativeTime", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("formats a few minutes ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

        const result = formatRelativeTime(new Date("2026-09-18T11:58:00Z"));

        expect(result).toContain("2");
        expect(result).toMatch(/Minute/);
    });

    it("formats a few hours ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

        const result = formatRelativeTime(new Date("2026-09-18T09:00:00Z"));

        expect(result).toMatch(/Stunde/);
    });

    it("formats days ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

        const result = formatRelativeTime(new Date("2026-09-15T12:00:00Z"));

        expect(result).toMatch(/Tag/);
    });

    it("formats seconds ago as a fallback for very recent times", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

        const result = formatRelativeTime(new Date("2026-09-18T11:59:45Z"));

        expect(result).toBe("vor 15 Sekunden");
    });

    describe("clock-skew tolerance", () => {
        it("clamps a few seconds of future drift to \"now\" instead of showing a future time", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

            const result = formatRelativeTime(new Date("2026-09-18T12:00:03Z"));

            expect(result).toBe("jetzt");
        });

        it("still reports a genuinely future time beyond the drift tolerance", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

            const result = formatRelativeTime(new Date("2026-09-18T12:05:00Z"));

            expect(result).toBe("in 5 Minuten");
        });

        it("does not clamp a past time near the tolerance boundary", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

            const result = formatRelativeTime(new Date("2026-09-18T11:59:57Z"));

            expect(result).toBe("vor 3 Sekunden");
        });
    });
});

describe("formatNumber", () => {
    it("formats with up to 1 decimal place by default", () => {
        expect(formatNumber(18.44)).toBe("18,4");
    });

    it("does not force a trailing zero", () => {
        expect(formatNumber(27)).toBe("27");
    });

    it("respects an explicit fractionDigits argument", () => {
        expect(formatNumber(4.2345, 2)).toBe("4,23");
        expect(formatNumber(4, 0)).toBe("4");
    });
});

describe("formatShare", () => {
    it("formats a 0..1 fraction as a percentage with a non-breaking space before %", () => {
        // U+00A0 (non-breaking space), per DIN 5008 — not a plain " ".
        expect(formatShare(0.45)).toBe("45\u00a0%");
    });

    it("rounds to at most 1 decimal place", () => {
        expect(formatShare(0.184)).toBe("18,4\u00a0%");
    });

    it("handles zero and values above 1", () => {
        expect(formatShare(0)).toBe("0\u00a0%");
        expect(formatShare(1.25)).toBe("125\u00a0%");
    });
});

describe("formatChange", () => {
    it("prefixes an upward change with +", () => {
        expect(formatChange(3.1, "up")).toBe("+3,1\u00a0%");
    });

    it("prefixes a downward change with U+2212 (minus sign, not a hyphen)", () => {
        expect(formatChange(6.8, "down")).toBe("\u22126,8\u00a0%");
    });

    it("prefixes a flat change with U+00B1 (plus-minus)", () => {
        expect(formatChange(0.2, "flat")).toBe("\u00b10,2\u00a0%");
    });

    it("uses the magnitude regardless of the sign already on changePercent", () => {
        // Providers disagree on whether changePercent is pre-signed; the
        // sign always comes from `trend`, so a negative input must not
        // double up as "+-6,8 %".
        expect(formatChange(-6.8, "down")).toBe("\u22126,8\u00a0%");
        expect(formatChange(-6.8, "up")).toBe("+6,8\u00a0%");
    });
});
