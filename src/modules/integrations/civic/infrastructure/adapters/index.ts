import { MockCivicDataProvider } from "./mock-civic-provider";
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
 * §21–22).
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
 * To add a real provider once a municipal REST/GraphQL adapter exists:
 *   1. Implement CivicDataProvider in a new file (e.g. rest-civic-provider.ts).
 *   2. Add a branch below for that resolved kind, constructing it from
 *      the resolved DataSource row's config.
 *   3. Zero component files change — they already call this function.
 */
export async function getCivicDataProvider(websiteId?: string): Promise<CivicDataProvider> {
    const { kind } = await resolveDataSourceKind(websiteId, "civic");

    switch (kind) {
        case "MOCK":
            return mockProvider();
        case "REST":
        case "GRAPHQL":
            // No adapter implemented yet (spec §52) — resolveDataSourceKind
            // already logs this and reports "MOCK" as the kind in that
            // case, so these branches are unreachable today but are kept
            // explicit (rather than falling through to `default`) so
            // adding a real adapter later is a compile error reminder
            // here, not a silent gap.
            return mockProvider();
    }
}
