import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

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

        expect(result).toMatch(/Sekunde|vor/);
    });
});
