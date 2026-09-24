import { ok, err } from "@/lib/result/result";
import type { Result } from "@/lib/result/result";
import type { DataSourceAdapter, DataDiscoveryResult, DataSourceContext, DataSourceError } from "@/modules/data-sources/domain/data-source-adapter";
import { AppErrors } from "@/lib/errors/app-error";
import { connectionFailure } from "@/modules/data-sources/application/adapter-helpers";
import type { DiscoveredField } from "@/modules/data-sources/domain/data-source-adapter";

function inferType(val: unknown): "string" | "number" | "boolean" | "array" | "object" | "null" {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return "number";
    return "string";
}

function inferDiscoveredFields(obj: Record<string, unknown>, prefix = "$"): DiscoveredField[] {
    const fields: DiscoveredField[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = `${prefix}.${key}`;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            fields.push({ path, sampleType: "object", sampleValue: "{...}" });
            fields.push(...inferDiscoveredFields(value as Record<string, unknown>, path));
        } else {
            fields.push({
                path,
                sampleType: inferType(value),
                sampleValue: String(value).slice(0, 50),
            });
        }
    }
    return fields;
}

/**
 * Adapter for MOCK data sources.
 * It simulates fetching data from an external API by reading from the
 * local mock payloads based on the dataset type.
 * 
 * Since the MOCK config schema is `{}`, we rely on a custom mechanism or
 * we can just adjust the MOCK config schema to take a `path` property!
 * Let's change the MOCK config schema in data-source-schema.ts to accept a `path`
 * so we can distinguish what to return.
 */
export const mockDataAdapter: DataSourceAdapter<Record<string, unknown>> = {
    parseConfig(rawConfig: unknown) {
        return ok(rawConfig as Record<string, unknown>);
    },

    async testConnection(_config: Record<string, unknown>, _context: DataSourceContext) {
        return ok({ statusCode: 200, responseTimeMs: 12 });
    },

    async fetch(config: Record<string, unknown>, _context: DataSourceContext): Promise<Result<unknown, DataSourceError>> {
        const { getMockPayload } = await import("@/data/musterstadt");
        const path = config.path as string || "";
        const payload = getMockPayload(path);
        if (!payload) {
            return err(connectionFailure(AppErrors.notFound(`Mock-Pfad ${path} nicht gefunden`), "INVALID_RESPONSE"));
        }
        return ok(payload);
    },

    async discover(config: Record<string, unknown>, context: DataSourceContext): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        const fetchResult = await this.fetch(config, context);
        if (!fetchResult.ok) return err(fetchResult.error);

        const sampleArray = Array.isArray(fetchResult.data) ? fetchResult.data : [fetchResult.data];
        if (sampleArray.length === 0) {
            return err(connectionFailure(AppErrors.validation("Mock-Daten sind leer"), "INVALID_RESPONSE"));
        }

        const sample = sampleArray.slice(0, 3);
        const fields = inferDiscoveredFields(sample[0] as Record<string, unknown>);

        return ok({ fields, sample });
    }
};
