import { MockSmartCityDataProvider } from "./mock-smartcity-provider";
import type { SmartCityDataProvider } from "./smartcity-data-provider";

export type { SmartCityDataProvider };

/**
 * Singleton accessor for the SmartCity data provider.
 *
 * This is the ONLY import point any component should use to obtain
 * SmartCity metrics. To swap providers:
 *   1. Implement SmartCityDataProvider in a new file.
 *   2. Replace `new MockSmartCityDataProvider()` below.
 *   3. Zero component files change.
 */
let instance: SmartCityDataProvider | null = null;

export function getSmartCityDataProvider(): SmartCityDataProvider {
    if (!instance) {
        instance = new MockSmartCityDataProvider();
    }
    return instance;
}
