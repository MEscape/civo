import { describe, it, expect } from "vitest";
import { smartCityMetricSchema } from "@/modules/content/domain/smartcity-schema";

describe("smartCityMetricSchema", () => {
    const base = { id: "kpi-1", label: "CO2-Reduktion", value: 18.4 };

    it("accepts a minimal metric", () => {
        expect(smartCityMetricSchema.safeParse(base).success).toBe(true);
    });

    it("rejects a non-numeric value", () => {
        expect(smartCityMetricSchema.safeParse({ ...base, value: "18.4" }).success).toBe(false);
    });

    it("rejects an invalid category", () => {
        expect(
            smartCityMetricSchema.safeParse({ ...base, category: "not-a-real-category" }).success
        ).toBe(false);
    });

    it("rejects an invalid trend", () => {
        expect(smartCityMetricSchema.safeParse({ ...base, trend: "sideways" }).success).toBe(false);
    });

    it("accepts a full series/breakdown payload", () => {
        const result = smartCityMetricSchema.safeParse({
            ...base,
            series: [{ date: "2026-01-01", value: 10 }],
            breakdown: [{ label: "Bereich A", value: 5 }],
            target: 25,
        });
        expect(result.success).toBe(true);
    });
});
