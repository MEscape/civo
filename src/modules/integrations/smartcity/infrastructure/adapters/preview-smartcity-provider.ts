/* eslint-disable @typescript-eslint/no-explicit-any */
import { ok } from "@/lib/result/result";
import { smartCityMetricSchema } from "@/modules/content/domain/smartcity-schema";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import type { SmartCityDataProvider } from "./smartcity-data-provider";

export class PreviewSmartCityDataProvider implements SmartCityDataProvider {
    async getMetrics(options?: { limit?: number; category?: string; includeSeries?: boolean; includeBreakdown?: boolean }) {
        const { MOCK_DATASETS, getMockPayload } = await import("@/data/musterstadt");
        const ds = MOCK_DATASETS.find(d => d.canonicalType === "SmartCityMetric");
        if (!ds) return ok([]);
        const payload = getMockPayload(ds.path);
        if (!payload || !Array.isArray(payload)) return ok([]);
        let items: SmartCityMetric[] = [];
        for (const raw of payload) {
            const rawAny = raw as any;
            const mapped: any = { id: rawAny.id || rawAny.svc_id || rawAny.kpi_id };
            for (const [key, path] of Object.entries(ds.mapping)) {
                if (typeof path === "string") {
                    mapped[key] = path.replace('$.', '').split('.').reduce((obj: any, p: string) => obj?.[p], raw);
                } else if (path && typeof path === "object" && "_array" in path) {
                    const arr = (path as any)._array.replace('$.', '').split('.').reduce((obj: any, p: string) => obj?.[p], raw);
                    if (Array.isArray(arr)) {
                        mapped[key] = arr.map(item => {
                            const mappedItem: any = {};
                            for (const [subKey, subPath] of Object.entries(path)) {
                                if (subKey === "_array") continue;
                                mappedItem[subKey] = (subPath as string).replace('$.', '').split('.').reduce((obj: any, p: string) => obj?.[p], item);
                            }
                            return mappedItem;
                        });
                    }
                }
            }
            const validated = smartCityMetricSchema.safeParse(mapped);
            if (validated.success) items.push(validated.data);
        }
        
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
}
