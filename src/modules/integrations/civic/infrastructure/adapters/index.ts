import { MockCivicDataProvider } from "./mock-civic-provider";
import type { CivicDataProvider } from "./civic-data-provider";

export type { CivicDataProvider };

/**
 * Singleton accessor for the civic data provider.
 *
 * This is the ONLY import point any component should use to obtain civic
 * content. The singleton is lazily initialized so that swapping from the
 * mock to a real provider means changing one line here and nowhere else.
 *
 * To swap providers:
 *   1. Implement CivicDataProvider in a new file (e.g. rest-civic-provider.ts).
 *   2. Replace `new MockCivicDataProvider()` with your implementation below.
 *   3. Zero component files change.
 */
let instance: CivicDataProvider | null = null;

export function getCivicDataProvider(): CivicDataProvider {
    if (!instance) {
        instance = new MockCivicDataProvider();
    }
    return instance;
}
