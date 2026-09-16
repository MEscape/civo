import { MockSmartCityDataProvider } from "./mock-smartcity-provider";
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
 * §21–22). Exact mirror of getCivicDataProvider — same pattern, same
 * resolver, different dataset key ("smartcity").
 *
 * `websiteId` is optional so existing call sites without website context
 * keep working, resolving to mock exactly as the old synchronous singleton
 * always did — backward-compatible superset, not a breaking change.
 *
 * To add a real provider once a SmartCity REST/GraphQL adapter exists:
 *   1. Implement SmartCityDataProvider in a new file.
 *   2. Add a branch below for that kind, constructing it from the
 *      resolved DataSource row's config.
 *   3. Zero component files change.
 */
export async function getSmartCityDataProvider(websiteId?: string): Promise<SmartCityDataProvider> {
    const { kind } = await resolveDataSourceKind(websiteId, "smartcity");

    switch (kind) {
        case "MOCK":
            return mockProvider();
        case "REST":
        case "GRAPHQL":
            // No adapter implemented yet — resolveDataSourceKind already
            // logs and reports "MOCK" for these, so these branches are
            // unreachable today but kept explicit as a compile-error
            // reminder when a real adapter is added.
            return mockProvider();
    }
}
