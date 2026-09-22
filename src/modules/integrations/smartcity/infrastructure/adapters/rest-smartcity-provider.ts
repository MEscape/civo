import type { SmartCityDataProvider } from "./smartcity-data-provider";
import { MockSmartCityDataProvider } from "./mock-smartcity-provider";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import { smartCityMetricSchema } from "@/modules/content/domain/smartcity-schema";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import { restDataSourceConfigSchema } from "@/modules/data-sources/domain/data-source-schema";
import { applyMapping, datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";
import { deriveMappedRecordId } from "@/modules/data-sources/infrastructure/derive-mapped-record-id";
import { cachedRestFetch } from "@/modules/data-sources/infrastructure/data-fetch-cache";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";

/**
 * REST-backed implementation of SmartCityDataProvider (Phase 3.5 spec
 * §12, §13). Mirrors RestCivicDataProvider's structure exactly — see that
 * file's doc comment for the reasoning behind mapping → canonical
 * validation → per-record skip-on-error → whole-source fallback to mock.
 *
 * SmartCityDataProvider has only one method (getMetrics), so unlike
 * RestCivicDataProvider there is no "delegate every other method"
 * concern here — a configured smartcity source either has a working
 * mapping for getMetrics, or the whole provider falls back to sample
 * metrics (spec §25).
 */
export class RestSmartCityDataProvider implements SmartCityDataProvider {
    private readonly fallback = new MockSmartCityDataProvider();

    constructor(private readonly source: DataSourceView) {}

    async getMetrics(options?: {
        category?: SmartCityMetric["category"];
    }): Promise<Result<SmartCityMetric[], AppError>> {
        const mappedResult = await this.fetchMappedMetrics();
        if (!mappedResult.ok) {
            logger.warn("RestSmartCityDataProvider.getMetrics falling back to mock data", {
                dataSourceId: this.source.id,
                cause: mappedResult.error,
            });
            return this.fallback.getMetrics(options);
        }

        let items = mappedResult.data;
        if (options?.category) items = items.filter((m) => m.category === options.category);
        return ok(items);
    }

    private async fetchMappedMetrics(): Promise<Result<SmartCityMetric[], AppError>> {
        if (!this.source.mapping) {
            return err(AppErrors.validation("Für diese Datenquelle ist noch keine Feldzuordnung konfiguriert."));
        }
        const mappingParsed = datasetMappingSchema.safeParse(this.source.mapping);
        if (!mappingParsed.success) {
            return err(AppErrors.validation("Die gespeicherte Feldzuordnung ist nicht mehr gültig."));
        }

        const configParsed = restDataSourceConfigSchema.safeParse(this.source.config);
        if (!configParsed.success) {
            return err(AppErrors.validation("Die gespeicherte Konfiguration der Datenquelle ist nicht mehr gültig."));
        }

        const fetchResult = await cachedRestFetch(
            this.source.id,
            this.source.dataset,
            this.source.updatedAt.toISOString(),
            () => restJsonAdapter.fetch(configParsed.data, { dataSourceId: this.source.id })
        );
        if (!fetchResult.ok) return err(fetchResult.error);

        const rawRecords = Array.isArray(fetchResult.data) ? fetchResult.data : [fetchResult.data];

        const metrics: SmartCityMetric[] = [];
        for (const raw of rawRecords) {
            const mapped = applyMapping(mappingParsed.data, raw);
            if (!mapped.ok) {
                logger.warn("RestSmartCityDataProvider: a record failed field mapping, skipping it", {
                    dataSourceId: this.source.id,
                    errors: mapped.error,
                });
                continue;
            }

            const candidate = { id: deriveMappedRecordId(raw, mapped.data), ...mapped.data };
            const validated = smartCityMetricSchema.safeParse(candidate);
            if (!validated.success) {
                logger.warn("RestSmartCityDataProvider: a mapped record failed canonical validation, skipping it", {
                    dataSourceId: this.source.id,
                    issues: validated.error.issues,
                });
                continue;
            }
            metrics.push(validated.data);
        }

        return ok(metrics);
    }
}
