import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatDate, formatNumber } from "./formatters";

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
