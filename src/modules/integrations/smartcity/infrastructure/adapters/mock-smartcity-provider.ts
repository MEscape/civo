import type { SmartCityDataProvider } from "./smartcity-data-provider";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { smartCityMetricListSchema } from "@/modules/content/domain/content-schema";
import { musterstadtSmartCityMetrics } from "@/data/musterstadt";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";

/**
 * Local/mock implementation of SmartCityDataProvider.
 *
 * Validates "external" data against the canonical Zod schemas before
 * returning it, so swapping in a real provider is a drop-in replacement.
 *
 * See `getSmartCityDataProvider()` in index.ts for the singleton accessor.
 */
export class MockSmartCityDataProvider implements SmartCityDataProvider {
    async getMetrics(options?: {
        category?: SmartCityMetric["category"];
    }): Promise<Result<SmartCityMetric[], AppError>> {
        const parsed = smartCityMetricListSchema.safeParse(musterstadtSmartCityMetrics);
        if (!parsed.success) {
            logger.error("Mock SmartCity metric data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.category) {
            items = items.filter((m) => m.category === options.category);
        }
        return ok(items);
    }
}
