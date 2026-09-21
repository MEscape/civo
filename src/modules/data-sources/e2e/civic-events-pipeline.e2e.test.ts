import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { DataSource as PrismaDataSource } from "@prisma/client";

/**
 * End-to-end test for Phase 3.5 (spec §31):
 *
 *   Configured REST API → Data source → Dataset → Mapping →
 *   Canonical Event → Events Grid → Builder Preview → Public Website
 *
 * This codebase's test suite is Vitest unit/component tests throughout —
 * no e2e browser framework (Playwright/Cypress) is present, and there is
 * no test database wired up in CI for this phase. So "end-to-end" here
 * means: mock only the two genuine system boundaries (the database, via
 * dataSourceRepository, and the external network, via global fetch) and
 * exercise every other real module exactly as production does — the
 * resolver, the REST adapter, the mapping engine, canonical Zod
 * validation, the provider, and the actual EventsGrid component
 * (imported unmodified, not reimplemented for the test). If any layer's
 * real wiring were broken — a wrong import path, a mismatched schema key,
 * a provider not actually calling the adapter — this test would fail
 * where a fully-mocked unit test of each layer in isolation could not
 * catch it.
 *
 * EventsGrid is rendered through @testing-library/react's `render`,
 * matching this codebase's existing convention for async Server
 * Components (see render-nodes.test.tsx) — no separate e2e/browser
 * runtime needed since React resolves the async component during render.
 */

vi.mock("@/modules/data-sources/infrastructure/data-source-repository", () => ({
    dataSourceRepository: {
        findByWebsiteAndDataset: vi.fn(),
    },
}));

// unstable_cache needs Next's request-time incremental cache, unavailable
// in a plain Vitest run — pass the wrapped function through uncached (see
// rest-civic-provider.test.ts for the same rationale).
vi.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const { dataSourceRepository } = await import("@/modules/data-sources/infrastructure/data-source-repository");
const { EventsGrid } = await import("@/modules/integrations/civic/components/events-grid/events-grid");

function configuredEventsSource(): PrismaDataSource {
    return {
        id: "e2e-events-source",
        websiteId: "website-e2e",
        name: "Municipal Events API",
        kind: "REST",
        dataset: "civic",
        config: {
            baseUrl: "https://example-municipality.de/api",
            path: "/events",
            authMode: "NONE",
        },
        // A realistic administrator-authored mapping (spec §24 step 8):
        // the external API uses different field names than the
        // canonical model, exactly like the phase spec's own worked
        // example (event_name → title, start → startDate, ...).
        mapping: {
            fields: [
                { sourcePath: "event_name", targetPath: "title", required: true },
                { sourcePath: "description", targetPath: "description", required: false },
                { sourcePath: "start", targetPath: "startDate", transform: { kind: "datetime" }, required: true },
                { sourcePath: "venue", targetPath: "location", required: false },
            ],
        },
        status: "OK",
        lastCheckedAt: new Date("2026-09-18T12:00:00Z"),
        lastError: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-18T12:00:00Z"),
    } as PrismaDataSource;
}

describe("End-to-end: configured REST source → mapping → canonical event → EventsGrid", () => {
    beforeEach(() => {
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({
            ok: true,
            data: configuredEventsSource(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("renders real municipal event data end-to-end on the public website render path", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify([
                        {
                            event_name: "Stadtfest Musterstadt",
                            description: "Das jährliche Stadtfest mit Musik und Marktständen.",
                            start: "2026-09-20T18:00:00",
                            venue: "Marktplatz",
                        },
                        {
                            event_name: "Weihnachtsmarkt",
                            start: "2026-12-01T10:00:00",
                            venue: "Rathausplatz",
                        },
                    ]),
                    { status: 200, headers: { "content-type": "application/json" } }
                )
            )
        );

        // This is the exact call the real render pipeline makes — see
        // render-nodes.tsx's PageNodeRenderer, which passes `props` and
        // `websiteId` straight through to the registered component.
        const jsx = await EventsGrid({ props: { heading: "Kommende Termine" }, websiteId: "website-e2e" });
        const { container } = render(jsx);

        // Proves the mapping actually ran: the rendered text uses the
        // MAPPED canonical field values, not the external API's raw
        // field names, and reflects both records from the fetch.
        expect(container.textContent).toContain("Kommende Termine");
        expect(container.textContent).toContain("Stadtfest Musterstadt");
        expect(container.textContent).toContain("Marktplatz");
        expect(container.textContent).toContain("Weihnachtsmarkt");
        expect(container.textContent).toContain("Rathausplatz");
    });

    it("respects the component's own limit prop after mapping real data", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify([
                        { event_name: "Event A", start: "2026-09-20T18:00:00" },
                        { event_name: "Event B", start: "2026-09-21T18:00:00" },
                        { event_name: "Event C", start: "2026-09-22T18:00:00" },
                    ]),
                    { status: 200 }
                )
            )
        );

        const jsx = await EventsGrid({ props: { limit: 2 }, websiteId: "website-e2e" });
        const { container } = render(jsx);

        expect(container.textContent).toContain("Event A");
        expect(container.textContent).toContain("Event B");
        expect(container.textContent).not.toContain("Event C");
    });

    it("degrades to sample data on the public render path when the external source is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

        // This is the Builder Preview / Public Website resilience
        // guarantee from spec §20, §25: the page must remain usable, not
        // show a broken component or a raw error, when the configured
        // external source is down.
        const jsx = await EventsGrid({ props: {}, websiteId: "website-e2e" });
        const { container } = render(jsx);

        // Falls back to MockCivicDataProvider's sample events rather
        // than an error state or empty render.
        expect(container.textContent).not.toContain("konnten derzeit nicht geladen werden");
        expect(container.textContent?.length).toBeGreaterThan(0);
    });

    it("skips only the invalid record when one of several external records is malformed", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify([
                        { event_name: "Valid Event", start: "2026-09-20T18:00:00" },
                        { event_name: "Broken Event", start: "not-a-real-date" },
                    ]),
                    { status: 200 }
                )
            )
        );

        const jsx = await EventsGrid({ props: {}, websiteId: "website-e2e" });
        const { container } = render(jsx);

        expect(container.textContent).toContain("Valid Event");
        expect(container.textContent).not.toContain("Broken Event");
    });

    it("falls back to mock data when no website context is available (e.g. a preview outside any website)", async () => {
        vi.stubGlobal("fetch", vi.fn());

        const jsx = await EventsGrid({ props: {}, websiteId: undefined });
        const { container } = render(jsx);

        expect(dataSourceRepository.findByWebsiteAndDataset).not.toHaveBeenCalled();
        expect(container.textContent?.length).toBeGreaterThan(0);
    });
});
