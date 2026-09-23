import { z } from "zod";
import { err, ok, type Result } from "@/lib/result/result";
import type { DatasetView } from "./dataset-schema";

/**
 * A website's configured data source (Phase 3.5).
 *
 * A DataSource represents a connection to an external system (REST endpoint,
 * mock, future: CKAN, WFS, ...). It no longer carries a "dataset" family
 * constraint — a website may have many DataSources of any mix. Each
 * DataSource exposes one or more named Datasets, each with its own
 * canonicalType and field mapping.
 *
 * Credentials are never stored in `config`. Secrets belong in server-only
 * environment configuration.
 */

export const dataSourceKindSchema = z.enum([
    "MOCK",
    "REST",
]);

export type DataSourceKind = z.infer<typeof dataSourceKindSchema>;

/**
 * Config shape for kind: "MOCK".
 *
 * The mock provider needs no configuration. The schema is intentionally
 * strict so MOCK is validated the same way as every other kind.
 */
export const mockDataSourceConfigSchema = z
    .object({})
    .strict();

/**
 * How a REST data source authenticates outbound requests.
 *
 * Only the mode is stored here. The actual credential is resolved from
 * server-only configuration at request time.
 */
export const authModeSchema = z.enum([
    "NONE",
    "API_KEY",
    "BEARER_TOKEN",
]);

export type AuthMode = z.infer<typeof authModeSchema>;

/**
 * Config shape for kind: "REST".
 *
 * No authentication material lives here.
 */
export const restDataSourceConfigSchema = z
    .object({
        baseUrl: z.url(),

        /** Path appended to baseUrl for discovery/fetch. */
        path: z.string().min(1).default("/"),

        authMode: authModeSchema.default("NONE"),
    })
    .strict();

export type RestDataSourceConfig = z.infer<
    typeof restDataSourceConfigSchema
>;

/**
 * Returns the configuration schema associated with a data-source kind.
 */
export function configSchemaForKind(kind: DataSourceKind) {
    switch (kind) {
        case "MOCK":
            return mockDataSourceConfigSchema;

        case "REST":
            return restDataSourceConfigSchema;
    }
}

/** Outcome of the most recent test-connection / fetch attempt. */
export const dataSourceStatusSchema = z.enum([
    "UNKNOWN",
    "OK",
    "ERROR",
]);

export type DataSourceStatus = z.infer<
    typeof dataSourceStatusSchema
>;

/**
 * Category of a test-connection/diagnostic failure.
 */
export const connectionDiagnosticCategorySchema = z.enum([
    "CONNECTION_FAILED",
    "AUTHENTICATION_FAILED",
    "INVALID_RESPONSE",
    "INVALID_CONFIGURATION",
]);

export type ConnectionDiagnosticCategory = z.infer<
    typeof connectionDiagnosticCategorySchema
>;

export const dataSourceSchema = z.object({
    id: z.string().min(1),
    websiteId: z.string().min(1),
    name: z.string().min(1),
    kind: dataSourceKindSchema,
    config: z.record(z.string(), z.unknown()),
    status: dataSourceStatusSchema,
    lastCheckedAt: z.date().nullable(),
    lastError: z.string().nullable(),
});

export type DataSourceEntity = z.infer<
    typeof dataSourceSchema
>;

/**
 * Input for creating a new DataSource for a website.
 * A website may have any number of sources — no per-kind constraint.
 */
export const createDataSourceSchema = z.object({
    websiteId: z.string().min(1),
    name: z.string().min(1).max(100),
    kind: dataSourceKindSchema,
    config: z
        .record(z.string(), z.unknown())
        .default({}),
});

export type CreateDataSourceInput = z.infer<
    typeof createDataSourceSchema
>;

/**
 * Validates a DataSource's config blob against the shape required by
 * its kind.
 *
 * Expected validation failures are returned as `err(...)`.
 * Unexpected programmer errors are not swallowed.
 */
export type DataSourceConfig =
    | z.infer<typeof mockDataSourceConfigSchema>
    | z.infer<typeof restDataSourceConfigSchema>;

export function validateDataSourceConfig(
    kind: DataSourceKind,
    config: unknown
): Result<DataSourceConfig, string> {
    const schema = configSchemaForKind(kind);
    const parsed = schema.safeParse(config);

    if (!parsed.success) {
        return err(
            parsed.error.issues[0]?.message ??
            "Ungültige Datenquellenkonfiguration."
        );
    }

    return ok(parsed.data as DataSourceConfig);
}

/**
 * Domain read-model for a DataSource.
 * Keeps Prisma dependencies isolated in the repository.
 * `datasets` is included when the repository loads the source with its relations.
 */
export type DataSourceView = {
    id: string;
    websiteId: string;
    name: string;
    kind: DataSourceKind;
    config: unknown;
    status: DataSourceStatus;
    lastCheckedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
    datasets?: DatasetView[];
};

/**
 * Maps an infrastructure-layer record (e.g. Prisma row) to the domain view.
 * Uses `any` for the row argument so the domain layer does not import Prisma types.
 */
type DataSourceRow = {
    id: string;
    websiteId: string;
    name: string;
    kind: string;
    config: unknown;
    status: string;
    lastCheckedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export function toDataSourceView(row: DataSourceRow, datasets?: DatasetView[]): DataSourceView {
    return {
        id: row.id,
        websiteId: row.websiteId,
        name: row.name,
        kind: row.kind as DataSourceKind,
        config: row.config,
        status: row.status as DataSourceStatus,
        lastCheckedAt: row.lastCheckedAt,
        lastError: row.lastError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        datasets,
    };
}
