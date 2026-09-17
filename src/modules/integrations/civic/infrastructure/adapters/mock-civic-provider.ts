import type { CivicDataProvider } from "./civic-data-provider";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import {
    newsItemListSchema,
    civicEventListSchema,
    serviceListSchema,
    contactListSchema,
    openingHoursListSchema,
    serviceDetailListSchema,
    councilBodyListSchema,
    wasteCollectionEntryListSchema,
    alertListSchema,
    departmentListSchema,
} from "@/modules/content/domain/content-schema";
import {
    musterstadtNews,
    musterstadtEvents,
    musterstadtServices,
    musterstadtContacts,
    musterstadtOpeningHours,
    musterstadtServiceDetails,
    musterstadtCouncilBodies,
    musterstadtWasteEntries,
    musterstadtAlerts,
    musterstadtDepartments,
} from "@/data/musterstadt";
import type { NewsItem } from "@/modules/content/domain/civic-types";

/**
 * Local/mock implementation of CivicDataProvider.
 *
 * This is the only provider wired up in the MVP. It simulates the shape
 * a real adapter would have — validating "external" data against the
 * canonical Zod schemas before returning it — so swapping in a real REST
 * or GraphQL-backed provider later is a drop-in replacement with no
 * changes required in any consuming component.
 *
 * See `getCivicDataProvider()` in index.ts for the singleton accessor —
 * components never instantiate this class directly.
 */
export class MockCivicDataProvider implements CivicDataProvider {
    async getNews(options?: {
        limit?: number;
        category?: string;
    }): Promise<Result<NewsItem[], AppError>> {
        const parsed = newsItemListSchema.safeParse(musterstadtNews);
        if (!parsed.success) {
            logger.error("Mock news data failed schema validation", { issues: parsed.error.issues });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.category) items = items.filter((i) => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }

    async getNewsBySlug(slug: string): Promise<Result<NewsItem | null, AppError>> {
        const parsed = newsItemListSchema.safeParse(musterstadtNews);
        if (!parsed.success) return err(AppErrors.internal(parsed.error));
        return ok(parsed.data.find((n) => n.slug === slug) ?? null);
    }

    async getEvents(options?: { limit?: number; category?: string }) {
        const parsed = civicEventListSchema.safeParse(musterstadtEvents);
        if (!parsed.success) {
            logger.error("Mock event data failed schema validation", { issues: parsed.error.issues });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.category) items = items.filter((i) => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }

    async getServices(options?: { limit?: number }) {
        const parsed = serviceListSchema.safeParse(musterstadtServices);
        if (!parsed.success) {
            logger.error("Mock service data failed schema validation", { issues: parsed.error.issues });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }

    async getContacts(options?: { limit?: number }) {
        const parsed = contactListSchema.safeParse(musterstadtContacts);
        if (!parsed.success) {
            logger.error("Mock contact data failed schema validation", { issues: parsed.error.issues });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }

    async getOpeningHours() {
        const parsed = openingHoursListSchema.safeParse(musterstadtOpeningHours);
        if (!parsed.success) {
            logger.error("Mock opening hours data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        return ok(parsed.data);
    }

    async getServiceDetails(options?: { category?: string }) {
        const parsed = serviceDetailListSchema.safeParse(musterstadtServiceDetails);
        if (!parsed.success) {
            logger.error("Mock service detail data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.category) items = items.filter((i) => i.category === options.category);
        return ok(items);
    }

    async getCouncilBodies() {
        const parsed = councilBodyListSchema.safeParse(musterstadtCouncilBodies);
        if (!parsed.success) {
            logger.error("Mock council bodies data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        return ok(parsed.data);
    }

    async getWasteCollectionEntries(options?: { district?: string; from?: Date }) {
        const parsed = wasteCollectionEntryListSchema.safeParse(musterstadtWasteEntries);
        if (!parsed.success) {
            logger.error("Mock waste entries data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.district) items = items.filter((i) => i.district === options.district);
        if (options?.from) items = items.filter((i) => i.date >= options.from!);
        return ok(items);
    }

    async getAlerts(options?: { activeOnly?: boolean }) {
        const parsed = alertListSchema.safeParse(musterstadtAlerts);
        if (!parsed.success) {
            logger.error("Mock alerts data failed schema validation", { issues: parsed.error.issues });
            return err(AppErrors.internal(parsed.error));
        }
        let items = parsed.data;
        if (options?.activeOnly) items = items.filter((i) => i.active);
        return ok(items);
    }

    async getDepartments() {
        const parsed = departmentListSchema.safeParse(musterstadtDepartments);
        if (!parsed.success) {
            logger.error("Mock departments data failed schema validation", {
                issues: parsed.error.issues,
            });
            return err(AppErrors.internal(parsed.error));
        }
        return ok(parsed.data);
    }
}
