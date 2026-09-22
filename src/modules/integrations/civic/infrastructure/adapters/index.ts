import { MockCivicDataProvider } from "./mock-civic-provider";
import { RestCivicDataProvider } from "./rest-civic-provider";
import type { CivicDataProvider } from "./civic-data-provider";
import { resolveDataSourceKind } from "@/modules/data-sources/infrastructure/data-source-resolver";

export type { CivicDataProvider };

/**
 * The mock provider instance is a stateless, pure-function-like reader of
 * static demo data (see mock-civic-provider.ts) — it has no per-website
 * state, so ONE instance is reused across every website resolved to
 * "MOCK", rather than constructing a new one per call. What varies per
 * website is which KIND of provider `getCivicDataProvider` resolves to,
 * not the mock implementation itself.
 */
let mockInstance: CivicDataProvider | null = null;
function mockProvider(): CivicDataProvider {
    if (!mockInstance) mockInstance = new MockCivicDataProvider();
    return mockInstance;
}

/**
 * Resolves the civic data provider for a given website (Phase 3 spec
 * §21–22, extended in Phase 3.5 §12 with a real REST-backed provider).
 *
 * This is the ONLY import point any component should use to obtain civic
 * content — components receive a canonical, source-agnostic
 * `CivicDataProvider`, never touching Prisma, an external API, or the
 * `DataSource` configuration model directly (spec §18, §60).
 *
 * `websiteId` is optional so existing call sites (and tests) that don't
 * have website context yet keep working, resolving to the mock provider
 * exactly as the old hardcoded singleton always did — this is a
 * backward-compatible superset of the previous behavior, not a breaking
 * change to the function's contract.
 *
 * RestCivicDataProvider is constructed fresh per call (not cached like
 * mockProvider()) since it closes over a specific `DataSource` row — the
 * mapping/config could change between requests, and the row itself is
 * already loaded by resolveDataSourceKind, so there is no separate fetch
 * to memoize here.
 */
export async function getCivicDataProvider(websiteId?: string): Promise<CivicDataProvider> {
    const { kind, row } = await resolveDataSourceKind(websiteId, "civic");

    switch (kind) {
        case "MOCK":
            return mockProvider();
        case "REST":
            return new RestCivicDataProvider(row);
    }
}
