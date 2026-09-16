import { z } from "zod";

/**
 * A website's configured data source (Phase 3 spec §22–23).
 *
 * Mirrors the Prisma `DataSource` model 1:1 — this module is the only
 * place that model's `kind`/`config` are interpreted. `kind` decides
 * which provider implementation a website's civic/smart-city components
 * resolve to; `config` is a small, kind-specific settings blob (e.g. a
 * REST base URL once a real adapter exists), never raw credentials (spec
 * §60 — secrets belong in server-only environment configuration, never in
 * a JSON column a website-management UI could end up echoing back).
 *
 * Intentionally NOT a generic "map any external API's fields to our
 * canonical model" engine (spec §23, §52) — each `kind` gets its own
 * fixed, small config shape below, and a brand-new external API means
 * writing a new adapter + a new `kind`, not configuring one.
 */
export const dataSourceKindSchema = z.enum(["MOCK", "REST", "GRAPHQL"]);
export type DataSourceKind = z.infer<typeof dataSourceKindSchema>;

/** Which canonical dataset family a DataSource applies to. */
export const dataSourceDatasetSchema = z.enum(["civic", "smartcity"]);
export type DataSourceDataset = z.infer<typeof dataSourceDatasetSchema>;

/**
 * Config shape for kind: "MOCK" — intentionally empty. The mock provider
 * needs no configuration; this schema exists so `MOCK` is validated the
 * same way every other kind is, rather than being a special case.
 */
export const mockDataSourceConfigSchema = z.object({}).strict();

/**
 * Config shape for kind: "REST" — the minimum needed to point at a
 * future municipal REST adapter (spec §59's "Future API Configuration
 * Boundary"). No auth material lives here; a real REST adapter would
 * resolve credentials from server-only environment variables keyed by
 * data source id, never from this JSON column (spec §60).
 */
export const restDataSourceConfigSchema = z
    .object({
        baseUrl: z.string().url(),
    })
    .strict();

/** Config shape for kind: "GRAPHQL" — same posture as REST, above. */
export const graphqlDataSourceConfigSchema = z
    .object({
        endpoint: z.string().url(),
    })
    .strict();

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

export const dataSourceSchema = z.object({
    id: z.string().min(1),
    websiteId: z.string().min(1),
    name: z.string().min(1),
    kind: dataSourceKindSchema,
    dataset: dataSourceDatasetSchema,
    config: z.record(z.string(), z.unknown()),
});
export type DataSourceEntity = z.infer<typeof dataSourceSchema>;

export const createDataSourceSchema = z.object({
    websiteId: z.string().min(1),
    name: z.string().min(1).max(100),
    kind: dataSourceKindSchema,
    dataset: dataSourceDatasetSchema,
    config: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;

/**
 * Validates a DataSource's `config` blob against the shape its own
 * `kind` requires. Called after createDataSourceSchema so a REST source
 * can't be saved with GraphQL-shaped (or empty, or malformed) config —
 * spec §55: "Do not accept arbitrary source strings/configuration
 * without validation."
 */
export function validateDataSourceConfig(
    kind: DataSourceKind,
    config: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
    const schema = configSchemaForKind(kind);
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
        return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid data source configuration." };
    }
    return { ok: true, data: parsed.data };
}
