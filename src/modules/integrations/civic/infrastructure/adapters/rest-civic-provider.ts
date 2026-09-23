import type { CivicDataProvider } from "./civic-data-provider";
import { MockCivicDataProvider } from "./mock-civic-provider";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import type { CivicEvent } from "@/modules/content/domain/civic-types";
import { civicEventSchema } from "@/modules/content/domain/civic-schema";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import { restDataSourceConfigSchema } from "@/modules/data-sources/domain/data-source-schema";
import { applyMapping, datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";
import { deriveMappedRecordId } from "@/modules/data-sources/infrastructure/derive-mapped-record-id";
import { cachedRestFetch } from "@/modules/data-sources/infrastructure/data-fetch-cache";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";
import type { DatasetView } from "@/modules/data-sources/domain/dataset-schema";
import { datasetCacheVersion } from "@/modules/data-sources/domain/source-cache-version";

/**
 * REST-backed implementation of CivicDataProvider (Phase 3.5 spec §12).
 *
 * Only `getEvents` is genuinely backed by the configured REST source —
 * the mapping UI (spec §9) targets CivicEvent specifically for the
 * "civic" dataset in this phase (see CANONICAL_TARGET_FIELDS in
 * field-mapping-schema.ts), matching the phase spec's own worked example
 * (§9, §24, §31 all use Events end-to-end). Every other method
 * (getNews, getServices, getContacts, ...) has no external mapping
 * configured yet and delegates to MockCivicDataProvider — this is not a
 * stub or a shortcut, it is spec §25's "builder must remain usable...
 * Using sample data" principle applied per-method rather than per-source:
 * a municipality that has only connected and mapped its events feed
 * should still see real events *and* a working (if sample) news grid,
 * rather than every other civic component breaking because one dataset
 * lacks a mapping.
 *
 * Extending this to a second mapped canonical type (e.g. NewsItem) is a
 * matter of adding another CANONICAL_TARGET_FIELDS key and a sibling
 * method here — not a redesign of this class.
 */
export class RestCivicDataProvider implements CivicDataProvider {
    private readonly fallback = new MockCivicDataProvider();

    constructor(
        private readonly source: DataSourceView,
        private readonly dataset: DatasetView
    ) {}

    async getEvents(options?: { limit?: number; category?: string }): Promise<Result<CivicEvent[], AppError>> {
        const mappedResult = await this.fetchMappedEvents();
        if (!mappedResult.ok) {
            logger.warn("RestCivicDataProvider.getEvents falling back to mock data", {
                dataSourceId: this.source.id,
                cause: mappedResult.error,
            });
            return this.fallback.getEvents(options);
        }

        let items = mappedResult.data;
        if (options?.category) items = items.filter((i) => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }

    private async fetchMappedEvents(): Promise<Result<CivicEvent[], AppError>> {
        if (!this.dataset.mapping) {
            return err(AppErrors.validation("Für diesen Datensatz ist noch keine Feldzuordnung konfiguriert."));
        }
        const mappingParsed = datasetMappingSchema.safeParse(this.dataset.mapping);
        if (!mappingParsed.success) {
            return err(AppErrors.validation("Die gespeicherte Feldzuordnung ist nicht mehr gültig."));
        }

        const configParsed = restDataSourceConfigSchema.safeParse(this.source.config);
        if (!configParsed.success) {
            return err(AppErrors.validation("Die gespeicherte Konfiguration der Datenquelle ist nicht mehr gültig."));
        }

        const fetchResult = await cachedRestFetch(
            this.dataset.id,
            this.dataset.canonicalType,
            datasetCacheVersion({
                sourceKind: this.source.kind,
                sourceConfig: this.source.config,
                datasetMapping: this.dataset.mapping,
            }),
            this.source.id,
            configParsed.data
        );
        if (!fetchResult.ok) return err(fetchResult.error);

        const rawRecords = Array.isArray(fetchResult.data) ? fetchResult.data : [fetchResult.data];

        const events: CivicEvent[] = [];
        for (const raw of rawRecords) {
            const mapped = applyMapping(mappingParsed.data, raw);
            if (!mapped.ok) {
                logger.warn("RestCivicDataProvider: a record failed field mapping, skipping it", {
                    dataSourceId: this.source.id,
                    errors: mapped.error,
                });
                continue;
            }

            const candidate = { id: deriveMappedRecordId(raw, mapped.data), ...mapped.data };
            const validated = civicEventSchema.safeParse(candidate);
            if (!validated.success) {
                logger.warn("RestCivicDataProvider: a mapped record failed canonical validation, skipping it", {
                    dataSourceId: this.source.id,
                    issues: validated.error.issues,
                });
                continue;
            }
            events.push(validated.data);
        }

        return ok(events);
    }

    // Every other method: no mapping targets these canonical types in
    // this phase, so serve sample data rather than an empty/broken
    // component (spec §25).
    getNews: CivicDataProvider["getNews"] = (options) => this.fallback.getNews(options);
    getNewsBySlug: CivicDataProvider["getNewsBySlug"] = (slug) => this.fallback.getNewsBySlug(slug);
    getServices: CivicDataProvider["getServices"] = (options) => this.fallback.getServices(options);
    getContacts: CivicDataProvider["getContacts"] = (options) => this.fallback.getContacts(options);
    getOpeningHours: CivicDataProvider["getOpeningHours"] = () => this.fallback.getOpeningHours();
    getServiceDetails: CivicDataProvider["getServiceDetails"] = (options) => this.fallback.getServiceDetails(options);
    getCouncilBodies: CivicDataProvider["getCouncilBodies"] = () => this.fallback.getCouncilBodies();
    getWasteCollectionEntries: CivicDataProvider["getWasteCollectionEntries"] = (options) =>
        this.fallback.getWasteCollectionEntries(options);
    getAlerts: CivicDataProvider["getAlerts"] = (options) => this.fallback.getAlerts(options);
    getDepartments: CivicDataProvider["getDepartments"] = () => this.fallback.getDepartments();
}
