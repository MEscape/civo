import { z } from "zod";
import { datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";
import { err, ok, type Result } from "@/lib/result/result";

/**
 * A website's configured data source (Phase 3 spec §22–23).
 *
 * Mirrors the Prisma `DataSource` model 1:1 — this module is the only
 * place that model's `kind`/`config` are interpreted. `kind` decides
 * which provider implementation a website's civic/smart-city components
 * resolve to; `config` is a small, kind-specific settings blob.
 *
 * Credentials are never stored in `config`. Secrets belong in server-only
 * environment configuration.
 */

export const dataSourceKindSchema = z.enum([
    "MOCK",
    "REST",
    "GRAPHQL",
]);

export type DataSourceKind = z.infer<typeof dataSourceKindSchema>;

/** Which canonical dataset family a DataSource applies to. */
export const dataSourceDatasetSchema = z.enum([
    "civic",
    "smartcity",
]);

export type DataSourceDataset = z.infer<
    typeof dataSourceDatasetSchema
>;

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
 * Config shape for kind: "GRAPHQL".
 */
export const graphqlDataSourceConfigSchema = z
    .object({
        endpoint: z.url(),
    })
    .strict();

export type GraphqlDataSourceConfig = z.infer<
    typeof graphqlDataSourceConfigSchema
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

        case "GRAPHQL":
            return graphqlDataSourceConfigSchema;
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
    dataset: dataSourceDatasetSchema,

    config: z.record(
        z.string(),
        z.unknown()
    ),

    mapping: datasetMappingSchema.nullable(),

    status: dataSourceStatusSchema,

    lastCheckedAt: z.date().nullable(),

    lastError: z.string().nullable(),
});

export type DataSourceEntity = z.infer<
    typeof dataSourceSchema
>;

/**
 * Input for creating or replacing the one configured source for a
 * (website, dataset) pair.
 */
export const createDataSourceSchema = z.object({
    websiteId: z.string().min(1),
    name: z.string().min(1).max(100),
    kind: dataSourceKindSchema,
    dataset: dataSourceDatasetSchema,

    config: z
        .record(z.string(), z.unknown())
        .default({}),
});

export type CreateDataSourceInput = z.infer<
    typeof createDataSourceSchema
>;

/**
 * Input for saving a completed field mapping.
 */
export const saveMappingSchema = z.object({
    dataSourceId: z.string().min(1),
    mapping: datasetMappingSchema,
});

export type SaveMappingInput = z.infer<
    typeof saveMappingSchema
>;

/**
 * Validates a DataSource's config blob against the shape required by
 * its kind.
 *
 * Expected validation failures are returned as `err(...)`.
 * Unexpected programmer errors are not swallowed.
 */
export function validateDataSourceConfig(
    kind: DataSourceKind,
    config: unknown
): Result<Record<string, unknown>, string> {
    const schema = configSchemaForKind(kind);
    const parsed = schema.safeParse(config);

    if (!parsed.success) {
        return err(
            parsed.error.issues[0]?.message ??
            "Ungültige Datenquellenkonfiguration."
        );
    }

    return ok(parsed.data as Record<string, unknown>);
}

/**
 * Domain read-model for a Data Source.
 * This is the public shape of a data source used by the application and presentation layers,
 * keeping Prisma dependencies isolated in the repository.
 */
export type DataSourceView = {
    id: string;
    websiteId: string;
    name: string;
    kind: DataSourceKind;
    dataset: DataSourceDataset;
    config: unknown;
    mapping: unknown | null;
    status: DataSourceStatus;
    lastCheckedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Maps an infrastructure-layer record (e.g. Prisma row) to the domain view.
 * Uses `any` for the row argument so the domain layer does not import Prisma types.
 * The repository handles calling this function with the correct Prisma shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDataSourceView(row: any): DataSourceView {
    return {
        id: row.id,
        websiteId: row.websiteId,
        name: row.name,
        kind: row.kind as DataSourceKind,
        dataset: row.dataset as DataSourceDataset,
        config: row.config,
        mapping: row.mapping,
        status: row.status as DataSourceStatus,
        lastCheckedAt: row.lastCheckedAt,
        lastError: row.lastError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
