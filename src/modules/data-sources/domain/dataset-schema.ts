import { z } from "zod";
import type { DataSourceStatus, DataSourceKind } from "./data-source-schema";
import { dataSourceStatusSchema } from "./data-source-schema";

/**
 * Every canonical type a Dataset can expose (Phase 3.5 §5).
 *
 * This is the stable contract between the data integration layer and the
 * website builder. Component definitions declare which canonicalType they
 * consume; the dataset selector filters by this type so only compatible
 * datasets appear.
 *
 * String enum rather than Prisma enum: it lives in domain code, not in
 * the database schema, so adding a new type here is a code change only —
 * no migration required.
 */
export const canonicalTypeSchema = z.enum([
    "Event",
    "NewsItem",
    "Service",
    "Contact",
    "OpeningHoursEntry",
    "ServiceDetail",
    "CouncilBody",
    "WasteCollectionEntry",
    "Alert",
    "Department",
    "SmartCityMetric",
]);

export type CanonicalType = z.infer<typeof canonicalTypeSchema>;

/**
 * Human-readable labels for canonical types, used in the settings UI
 * (canonical type chip) and dataset management forms.
 */
export const CANONICAL_TYPE_LABELS: Record<CanonicalType, string> = {
    Event: "Veranstaltung",
    NewsItem: "Nachricht",
    Service: "Dienstleistung",
    Contact: "Kontakt",
    OpeningHoursEntry: "Öffnungszeiten",
    ServiceDetail: "Dienstleistung (Detail)",
    CouncilBody: "Ratsgremium",
    WasteCollectionEntry: "Abfallkalender",
    Alert: "Hinweis",
    Department: "Abteilung",
    SmartCityMetric: "Smart-City-Kennzahl",
};

/* -------------------------------------------------------------------------- */
/* Domain read model                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Domain read-model for a Dataset.
 * `sourceName` and `sourceKind` are denormalised from the parent DataSource
 * for the dataset selector UI — avoids a separate join at the display layer.
 */
export type DatasetView = {
    id: string;
    dataSourceId: string;
    /** Denormalised from parent DataSource — for selector display. */
    sourceName: string;
    /** Denormalised from parent DataSource — drives provider selection. */
    sourceKind: DataSourceKind;
    /** Denormalised from parent DataSource — for selector status badge. */
    sourceStatus: DataSourceStatus;
    name: string;
    slug: string;
    canonicalType: CanonicalType;
    mapping: unknown | null;
    status: DataSourceStatus;
    lastFetchedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Maps an infrastructure-layer record (Prisma row with included dataSource)
 * to the domain read-model. The repository calls this; nothing above the
 * repository imports Prisma types.
 */
type DatasetRow = {
    id: string;
    dataSourceId: string;
    name: string;
    slug: string;
    canonicalType: string;
    mapping: unknown | null;
    status: string;
    lastFetchedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dataSource?: {
        name: string;
        kind: string;
        status: string;
    } | null;
};

export function toDatasetView(row: DatasetRow): DatasetView {
    return {
        id: row.id,
        dataSourceId: row.dataSourceId,
        sourceName: row.dataSource?.name ?? "",
        sourceKind: (row.dataSource?.kind ?? "MOCK") as DataSourceKind,
        sourceStatus: (row.dataSource?.status ?? "UNKNOWN") as DataSourceStatus,
        name: row.name,
        slug: row.slug,
        canonicalType: row.canonicalType as CanonicalType,
        mapping: row.mapping ?? null,
        status: row.status as DataSourceStatus,
        lastFetchedAt: row.lastFetchedAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                 */
/* -------------------------------------------------------------------------- */

export const datasetSchema = z.object({
    id: z.string().min(1),
    dataSourceId: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    canonicalType: canonicalTypeSchema,
    mapping: z.record(z.string(), z.unknown()).nullable(),
    status: dataSourceStatusSchema,
    lastFetchedAt: z.date().nullable(),
});

/**
 * Input for creating a Dataset inside an existing DataSource.
 * The caller must have already confirmed the DataSource belongs to their website.
 */
export const createDatasetSchema = z.object({
    dataSourceId: z.string().min(1),
    name: z.string().min(1).max(100),
    slug: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche erlaubt."),
    canonicalType: canonicalTypeSchema,
});

export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;

/**
 * Input for updating a Dataset's presentation metadata (not its mapping —
 * that has its own dedicated flow via saveMapping).
 */
export const updateDatasetSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche erlaubt.")
        .optional(),
});

export type UpdateDatasetInput = z.infer<typeof updateDatasetSchema>;

/**
 * Input for saving a completed field mapping for a Dataset.
 * Mirrors saveMappingSchema from data-source-schema but targets a Dataset row.
 */
export const saveDatasetMappingSchema = z.object({
    datasetId: z.string().min(1),
    mapping: z.record(z.string(), z.unknown()),
});

export type SaveDatasetMappingInput = z.infer<typeof saveDatasetMappingSchema>;
