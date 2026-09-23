import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";
import type { DataSourceError } from "@/modules/data-sources/domain/data-source-adapter";
import type { CanonicalType } from "@/modules/data-sources/domain/dataset-schema";
import type { RestDataSourceConfig } from "@/modules/data-sources/domain/data-source-schema";
import { logger } from "@/lib/logger/logger";

async function executeFetch(
    datasetId: string,
    canonicalType: CanonicalType,
    cacheKeyVersion: string,
    dataSourceId: string,
    config: RestDataSourceConfig
): Promise<unknown> {
    "use cache";
    cacheTag(`dataset:${datasetId}`);
    cacheLife("minutes");

    const result = await restJsonAdapter.fetch(config, { dataSourceId });
    if (!result.ok) throw result.error;
    return result.data;
}

export async function cachedRestFetch(
    datasetId: string,
    canonicalType: CanonicalType,
    cacheKeyVersion: string,
    dataSourceId: string,
    config: RestDataSourceConfig
): Promise<Result<unknown, DataSourceError>> {
    try {
        const data = await executeFetch(datasetId, canonicalType, cacheKeyVersion, dataSourceId, config);
        return ok(data);
    } catch (cause) {
        logger.error("Cached REST fetch failed:", { cause, dataSourceId, datasetId, canonicalType });
        return err(cause as DataSourceError);
    }
}
