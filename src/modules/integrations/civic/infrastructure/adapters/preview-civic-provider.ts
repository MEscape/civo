/* eslint-disable @typescript-eslint/no-explicit-any */
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";

import { 
    newsItemSchema, civicEventSchema, serviceSchema, contactSchema, 
    openingHoursEntrySchema, serviceDetailSchema, councilBodySchema, 
    wasteCollectionEntrySchema, alertSchema, departmentSchema 
} from "@/modules/content/domain/civic-schema";
import type { z } from "zod";
import type { CivicDataProvider } from "./civic-data-provider";

export class PreviewCivicDataProvider implements CivicDataProvider {
    private async getMapped<T>(canonicalType: string, schema: z.ZodType<T>): Promise<T[]> {
        const { MOCK_DATASETS, getMockPayload } = await import("@/data/musterstadt");
        const ds = MOCK_DATASETS.find(d => d.canonicalType === canonicalType);
        if (!ds) return [];
        const payload = getMockPayload(ds.path);
        if (!payload || !Array.isArray(payload)) return [];
        
        const items: T[] = [];
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
            const validated = schema.safeParse(mapped);
            if (validated.success) items.push(validated.data as T);
        }
        return items;
    }

    async getNews(options?: { limit?: number; category?: string }) {
        let items = await this.getMapped("NewsItem", newsItemSchema);
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getNewsBySlug(slug: string) {
        const items = await this.getMapped("NewsItem", newsItemSchema);
        const item = items.find(i => i.slug === slug);
        return item ? ok(item) : err(AppErrors.notFound("Meldung"));
    }
    async getEvents(options?: { limit?: number; category?: string }) {
        let items = await this.getMapped("Event", civicEventSchema);
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getServices(options?: { limit?: number }) {
        let items = await this.getMapped("Service", serviceSchema);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getContacts(options?: { limit?: number }) {
        let items = await this.getMapped("Contact", contactSchema);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getOpeningHours() { return ok(await this.getMapped("OpeningHoursEntry", openingHoursEntrySchema)); }
    async getServiceDetails() { return ok(await this.getMapped("ServiceDetail", serviceDetailSchema)); }
    async getCouncilBodies() { return ok(await this.getMapped("CouncilBody", councilBodySchema)); }
    async getWasteCollection() { return ok(await this.getMapped("WasteCollectionEntry", wasteCollectionEntrySchema)); }
    async getWasteCollectionEntries() { return ok(await this.getMapped("WasteCollectionEntry", wasteCollectionEntrySchema)); }
    async getAlerts() { return ok(await this.getMapped("Alert", alertSchema)); }
    async getDepartments() { return ok(await this.getMapped("Department", departmentSchema)); }
}
