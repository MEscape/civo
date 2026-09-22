import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";

/**
 * End-to-end test for the smart-city half of Phase 3.5's pipeline (spec
 * §13's "Mobility... Parking" example), mirroring
 * civic-events-pipeline.e2e.test.tsx — see that file's top comment for
 * why this is structured as "mock only the DB and the network, exercise
 * every real module in between" rather than a browser-driven e2e test.
 */

vi.mock("@/modules/data-sources/infrastructure/data-source-repository", () => ({
    dataSourceRepository: {
        findByWebsiteAndDataset: vi.fn(),
    },
}));

vi.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("node:dns/promises", () => {
    const mockLookup = vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]);
    return {
        default: { lookup: mockLookup },
        lookup: mockLookup,
    };
});

const { dataSourceRepository } = await import("@/modules/data-sources/infrastructure/data-source-repository");
const { KpiGrid } = await import("@/modules/integrations/smartcity/components/kpi-grid/kpi-grid");

function configuredParkingSource(): DataSourceView {
    return {
        id: "e2e-parking-source",
        websiteId: "website-e2e",
        name: "Smart Parking",
        kind: "REST",
        dataset: "smartcity",
        config: { baseUrl: "https://example-municipality.de/api", path: "/parking", authMode: "NONE" },
        mapping: {
            fields: [
                { sourcePath: "name", targetPath: "label", required: true },
                { sourcePath: "free_spaces", targetPath: "value", transform: { kind: "number" }, required: true },
                { sourcePath: "unit_label", targetPath: "unit", required: false },
            ],
        },
        status: "OK",
        lastCheckedAt: new Date("2026-09-18T12:00:00Z"),
        lastError: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-18T12:00:00Z"),
    } as DataSourceView;
}

describe("End-to-end: configured REST source → mapping → canonical metric → KpiGrid", () => {
    beforeEach(() => {
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({
            ok: true,
            data: configuredParkingSource(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("renders real parking availability data end-to-end", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify([
                        { name: "Marktplatz", free_spaces: 12, unit_label: "frei" },
                        { name: "Rathaus", free_spaces: 4, unit_label: "frei" },
                    ]),
                    { status: 200, headers: { "content-type": "application/json" } }
                )
            )
        );

        const jsx = await KpiGrid({ props: { heading: "Parkplätze" }, websiteId: "website-e2e" });
        const { container } = render(jsx);

        expect(container.textContent).toContain("Parkplätze");
        expect(container.textContent).toContain("Marktplatz");
        expect(container.textContent).toContain("12");
        expect(container.textContent).toContain("Rathaus");
        expect(container.textContent).toContain("4");
    });

    it("degrades to sample data when the parking API is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

        const jsx = await KpiGrid({ props: {}, websiteId: "website-e2e" });
        const { container } = render(jsx);

        expect(container.textContent?.length).toBeGreaterThan(0);
    });
});
