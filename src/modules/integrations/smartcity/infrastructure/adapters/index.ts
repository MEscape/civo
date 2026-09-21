import { MockSmartCityDataProvider } from "./mock-smartcity-provider";
import { RestSmartCityDataProvider } from "./rest-smartcity-provider";
import type { SmartCityDataProvider } from "./smartcity-data-provider";
import { resolveDataSourceKind } from "@/modules/data-sources/infrastructure/data-source-resolver";

export type { SmartCityDataProvider };

/**
 * The mock provider is stateless — one instance is reused across every
 * website resolved to "MOCK", rather than constructing a new one per call.
 * What varies per website is which KIND of provider resolves, not the mock
 * implementation itself.
 */
let mockInstance: SmartCityDataProvider | null = null;
function mockProvider(): SmartCityDataProvider {
    if (!mockInstance) mockInstance = new MockSmartCityDataProvider();
    return mockInstance;
}

/**
 * Resolves the SmartCity data provider for a given website (Phase 3 spec
 * §21–22, extended in Phase 3.5 §12 with a real REST-backed provider).
 * Exact mirror of getCivicDataProvider — same pattern, same resolver,
 * different dataset key ("smartcity").
 *
 * `websiteId` is optional so existing call sites without website context
 * keep working, resolving to mock exactly as the old synchronous singleton
 * always did — backward-compatible superset, not a breaking change.
 *
 * RestSmartCityDataProvider is constructed fresh per call (not cached),
 * matching getCivicDataProvider's RestCivicDataProvider — see that
 * file's comment for why.
 *
 * To add a GraphQL adapter once one exists:
 *   1. Implement SmartCityDataProvider in a new file.
 *   2. Add a branch below for "GRAPHQL", constructing it from `row`.
 *   3. Zero component files change.
 */
export async function getSmartCityDataProvider(websiteId?: string): Promise<SmartCityDataProvider> {
    const { kind, row } = await resolveDataSourceKind(websiteId, "smartcity");

    switch (kind) {
        case "MOCK":
            return mockProvider();
        case "REST":
            return new RestSmartCityDataProvider(row);
        case "GRAPHQL":
            // No GraphQL adapter implemented yet — resolveDataSourceKind
            // already logs and reports "MOCK" for this case, so this
            // branch is unreachable today but kept explicit as a
            // compile-error reminder when a real adapter is added.
            return mockProvider();
    }
}
