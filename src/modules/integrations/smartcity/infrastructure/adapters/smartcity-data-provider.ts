import type { Result } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";

/**
 * The abstraction every SmartCity-content-consuming component is built against.
 *
 * Separated from CivicDataProvider because SmartCity metrics are a distinct
 * product feature: a municipality can have civic content without SmartCity
 * dashboards, and a future SmartCity-only customer need not implement the
 * full civic interface.
 *
 * Implementations:
 *  - MockSmartCityDataProvider (src/modules/integrations/smartcity/infrastructure/adapters/mock-smartcity-provider.ts)
 *  - Future: RestSmartCityDataProvider, GraphQLSmartCityDataProvider, etc.
 *
 * @see CivicDataProvider for news, events, services, contacts, and other
 * civic content.
 */
export interface SmartCityDataProvider {
    getMetrics(options?: {
        category?: SmartCityMetric["category"];
    }): Promise<Result<SmartCityMetric[], AppError>>;
}
