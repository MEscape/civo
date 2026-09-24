import { describe, it, expect } from "vitest";
import {
    newsItemSchema,
    civicEventSchema,
    alertSchema,
    wasteCollectionEntrySchema,
    departmentSchema,
} from "@/modules/content/domain/civic-schema";

describe("newsItemSchema", () => {
    it("accepts a minimal valid item (only required fields)", () => {
        const result = newsItemSchema.safeParse({
            id: "news-1",
            title: "Titel",
            slug: "titel",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a missing id", () => {
        expect(newsItemSchema.safeParse({ title: "Titel", slug: "titel" }).success).toBe(false);
    });

    it("rejects an invalid imageUrl", () => {
        expect(
            newsItemSchema.safeParse({
                id: "news-1",
                title: "Titel",
                slug: "titel",
                imageUrl: "not-a-url",
            }).success
        ).toBe(false);
    });

    it("coerces a date string for publishedAt", () => {
        const result = newsItemSchema.safeParse({
            id: "news-1",
            title: "Titel",
            slug: "titel",
            publishedAt: "2026-08-18",
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(typeof result.data.publishedAt).toBe("string");
        }
    });
});

describe("civicEventSchema", () => {
    it("requires startDate", () => {
        expect(
            civicEventSchema.safeParse({ id: "e1", title: "Herbstmarkt" }).success
        ).toBe(false);
    });

    it("accepts an event with only startDate (endDate optional)", () => {
        expect(
            civicEventSchema.safeParse({
                id: "e1",
                title: "Herbstmarkt",
                startDate: "2026-09-27T10:00:00",
            }).success
        ).toBe(true);
    });
});

describe("alertSchema", () => {
    it("requires severity and active", () => {
        expect(alertSchema.safeParse({ id: "a1", title: "Titel" }).success).toBe(false);
    });

    it("rejects an invalid severity", () => {
        expect(
            alertSchema.safeParse({ id: "a1", title: "Titel", severity: "critical", active: true }).success
        ).toBe(false);
    });

    it("accepts each valid severity", () => {
        for (const severity of ["info", "warning", "urgent"] as const) {
            expect(
                alertSchema.safeParse({ id: "a1", title: "Titel", severity, active: true }).success
            ).toBe(true);
        }
    });
});

describe("wasteCollectionEntrySchema", () => {
    it("rejects an invalid wasteType", () => {
        expect(
            wasteCollectionEntrySchema.safeParse({
                id: "w1",
                date: "2026-09-20",
                wasteType: "not-a-real-type",
            }).success
        ).toBe(false);
    });

    it("accepts every documented wasteType", () => {
        for (const wasteType of ["restmuell", "biomuell", "papier", "gelberSack", "sperrmuell"] as const) {
            expect(
                wasteCollectionEntrySchema.safeParse({ id: "w1", date: "2026-09-20", wasteType }).success
            ).toBe(true);
        }
    });
});

describe("departmentSchema", () => {
    it("requires a contacts array, but allows it to be empty", () => {
        const result = departmentSchema.safeParse({ id: "d1", name: "Bürgerbüro", contacts: [] });
        expect(result.success).toBe(true);
    });

    it("rejects a missing contacts field entirely", () => {
        expect(departmentSchema.safeParse({ id: "d1", name: "Bürgerbüro" }).success).toBe(false);
    });

    it("validates nested contact emails", () => {
        const result = departmentSchema.safeParse({
            id: "d1",
            name: "Bürgerbüro",
            contacts: [{ id: "c1", name: "Petra Schmitz", email: "not-an-email" }],
        });
        expect(result.success).toBe(false);
    });
});
