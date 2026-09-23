import { z } from "zod";
import { err, ok, type Result } from "@/lib/result/result";
import type { CanonicalType } from "./dataset-schema";

/**
 * Explicit, serializable field mapping from an external record's shape to
 * a canonical content field (Phase 3.5 spec §9, §28).
 *
 * This is deliberately NOT a programming language. `sourcePath` and
 * `targetPath` are dot/bracket paths resolved by getByPath/setByPath.
 * No arbitrary code or expressions are evaluated.
 */

export const transformKindSchema = z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "datetime",
    "url",
    "join",
    "fallback",
]);

export type TransformKind = z.infer<typeof transformKindSchema>;

export const transformDefinitionSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("string") }),
    z.object({ kind: z.literal("number") }),
    z.object({ kind: z.literal("boolean") }),
    z.object({ kind: z.literal("date") }),
    z.object({ kind: z.literal("datetime") }),
    z.object({ kind: z.literal("url") }),
    z.object({
        kind: z.literal("join"),
        sourcePaths: z.array(z.string().min(1)).min(1).max(6),
        separator: z.string().max(20).default(", "),
    }),
    z.object({
        kind: z.literal("fallback"),
        value: z.union([z.string(), z.number(), z.boolean()]),
    }),
]);

export type TransformDefinition = z.infer<typeof transformDefinitionSchema>;

/**
 * Property names that must never be traversed or written by a path.
 * Writing through `__proto__` (or `constructor.prototype`) would mutate
 * `Object.prototype` for the entire server process.
 */
const FORBIDDEN_PATH_SEGMENTS: ReadonlySet<string> = new Set(["__proto__", "prototype", "constructor"]);

/** Maximum nesting depth of a target path such as `location.address.city`. */
const MAX_TARGET_PATH_DEPTH = 5;

function splitPath(path: string): string[] {
    return path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
}

function hasForbiddenSegment(path: string): boolean {
    return splitPath(path).some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
}

/**
 * Target paths are written to, so they are stricter than source paths:
 * plain dot-separated identifiers only (no array indexes), bounded depth,
 * and no forbidden segments.
 */
const targetPathSchema = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/, "Target path must be dot-separated field names.")
    .refine((path) => !hasForbiddenSegment(path), "Target path contains a forbidden segment.")
    .refine((path) => path.split(".").length <= MAX_TARGET_PATH_DEPTH, "Target path is nested too deeply.");

const sourcePathSchema = z
    .string()
    .min(1)
    .max(200)
    .refine((path) => !hasForbiddenSegment(path), "Source path contains a forbidden segment.");

/** One field mapping. */
export const fieldMappingSchema = z.object({
    sourcePath: sourcePathSchema,
    targetPath: targetPathSchema,
    transform: transformDefinitionSchema.optional(),
    required: z.boolean().default(false),
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

/**
 * Whether one target path is the same as, or an ancestor/descendant of,
 * another. `location` and `location.name` conflict: writing the first
 * would clobber (or be clobbered by) the second.
 */
function targetPathsConflict(a: string, b: string): boolean {
    return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

export const datasetMappingSchema = z
    .object({
        fields: z.array(fieldMappingSchema).min(1).max(50),
    })
    .superRefine((mapping, context) => {
        mapping.fields.forEach((field, index) => {
            const conflicting = mapping.fields.findIndex(
                (other, otherIndex) =>
                    otherIndex < index && targetPathsConflict(other.targetPath, field.targetPath)
            );

            if (conflicting !== -1) {
                context.addIssue({
                    code: "custom",
                    path: ["fields", index, "targetPath"],
                    message: `"${field.targetPath}" wurde bereits einem anderen Feld zugeordnet.`,
                });
            }
        });
    });

export type DatasetMapping = z.infer<typeof datasetMappingSchema>;

export type CanonicalTargetField = {
    path: string;
    required: boolean;
};

/**
 * Canonical target fields a mapping may fill, keyed by CanonicalType.
 *
 * The domain owns the field paths and which are required; display labels are a
 * presentation concern and live in the components layer. Each canonical type
 * has its own field list — the mapping UI shows only the fields that apply
 * to the type the Dataset has declared.
 */
export const CANONICAL_TARGET_FIELDS: Record<CanonicalType, readonly CanonicalTargetField[]> = {
    Event: [
        { path: "title", required: true },
        { path: "description", required: false },
        { path: "startDate", required: true },
        { path: "endDate", required: false },
        { path: "location", required: false },
        { path: "category", required: false },
        { path: "imageUrl", required: false },
    ],
    NewsItem: [
        { path: "title", required: true },
        { path: "slug", required: true },
        { path: "excerpt", required: false },
        { path: "content", required: false },
        { path: "imageUrl", required: false },
        { path: "publishedAt", required: false },
        { path: "category", required: false },
    ],
    Service: [
        { path: "title", required: true },
        { path: "href", required: true },
        { path: "description", required: false },
        { path: "icon", required: false },
    ],
    Contact: [
        { path: "name", required: true },
        { path: "role", required: false },
        { path: "email", required: false },
        { path: "phone", required: false },
    ],
    Alert: [
        { path: "title", required: true },
        { path: "message", required: false },
        { path: "severity", required: true },
        { path: "active", required: true },
        { path: "href", required: false },
    ],
    SmartCityMetric: [
        { path: "label", required: true },
        { path: "value", required: true },
        { path: "unit", required: false },
        { path: "category", required: false },
        { path: "trend", required: false },
        { path: "changePercent", required: false },
    ],
    OpeningHoursEntry: [
        { path: "dayOfWeek", required: true },
        { path: "openTime", required: true },
        { path: "closeTime", required: true },
    ],
    ServiceDetail: [
        { path: "title", required: true },
        { path: "description", required: false },
        { path: "requirements", required: false },
        { path: "costs", required: false },
        { path: "href", required: false },
    ],
    CouncilBody: [
        { path: "name", required: true },
        { path: "role", required: false },
        { path: "party", required: false },
        { path: "imageUrl", required: false },
    ],
    WasteCollectionEntry: [
        { path: "district", required: true },
        { path: "wasteType", required: true },
        { path: "collectionDate", required: true },
    ],
    Department: [
        { path: "name", required: true },
        { path: "description", required: false },
        { path: "contact", required: false },
        { path: "address", required: false },
    ],
};

/**
 * Reads a dot/bracket path from an unknown value. Returns undefined for
 * any missing, invalid or forbidden segment; never throws and never
 * reads inherited properties.
 */
export function getByPath(source: unknown, path: string): unknown {
    let current: unknown = source;

    for (const segment of splitPath(path)) {
        if (current === null || current === undefined || typeof current !== "object") {
            return undefined;
        }

        if (FORBIDDEN_PATH_SEGMENTS.has(segment)) return undefined;

        if (!Object.hasOwn(current, segment)) return undefined;

        current = (current as Record<string, unknown>)[segment];
    }

    return current;
}

/**
 * Writes a value to a dot path on a plain object. Target-side array
 * indexes are intentionally unsupported. Refuses forbidden segments even
 * when a persisted mapping predates the schema-level check.
 *
 * Returns false when the write was refused.
 */
function setByPath(target: Record<string, unknown>, path: string, value: unknown): boolean {
    const segments = splitPath(path);

    if (segments.length === 0) return false;

    if (segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) return false;

    let current = target;

    for (const segment of segments.slice(0, -1)) {
        const next = Object.hasOwn(current, segment) ? current[segment] : undefined;

        if (typeof next !== "object" || next === null || Array.isArray(next)) {
            const created: Record<string, unknown> = {};

            current[segment] = created;
            current = created;
        } else {
            current = next as Record<string, unknown>;
        }
    }

    current[segments[segments.length - 1]!] = value;

    return true;
}

/** Structured failure from applying a single field mapping. */
export type MappingFieldError = {
    targetPath: string;
    message: string;
};

function isBlank(value: unknown): boolean {
    return value === undefined || value === null || value === "";
}

/**
 * Applies one fixed transform. All expected transform failures are
 * represented by Result; no expected input error throws.
 */
function applyTransform(
    transform: TransformDefinition | undefined,
    rawValue: unknown,
    record: unknown
): Result<unknown, string> {
    if (!transform) return ok(rawValue);

    switch (transform.kind) {
        case "string": {
            if (rawValue === undefined || rawValue === null) return ok(undefined);

            return ok(String(rawValue));
        }

        case "number": {
            if (isBlank(rawValue)) return ok(undefined);

            const num = Number(rawValue);

            if (Number.isNaN(num)) return err(`"${String(rawValue)}" is not a valid number.`);

            return ok(num);
        }

        case "boolean": {
            if (rawValue === undefined || rawValue === null) return ok(undefined);

            if (typeof rawValue === "boolean") return ok(rawValue);

            if (rawValue === "true") return ok(true);

            if (rawValue === "false") return ok(false);

            return err(`"${String(rawValue)}" is not a valid boolean.`);
        }

        case "date":
        case "datetime": {
            if (isBlank(rawValue)) return ok(undefined);

            const date = new Date(rawValue as string | number);

            if (Number.isNaN(date.getTime())) return err(`"${String(rawValue)}" ist kein gültiges Datum.`);

            return ok(date);
        }

        case "url": {
            if (isBlank(rawValue)) return ok(undefined);

            try {
                const url = new URL(String(rawValue));

                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    return err(`"${String(rawValue)}" must be an http(s) URL.`);
                }

                return ok(url.toString());
            } catch {
                return err(`"${String(rawValue)}" is not a valid URL.`);
            }
        }

        case "join": {
            const parts = transform.sourcePaths
                .map((path) => getByPath(record, path))
                .filter((value) => !isBlank(value))
                .map(String);

            return ok(parts.length > 0 ? parts.join(transform.separator) : undefined);
        }

        case "fallback": {
            if (isBlank(rawValue)) return ok(transform.value);

            return ok(rawValue);
        }
    }
}

/**
 * Applies a dataset's field mappings to one external record. Expected
 * mapping/transform failures are returned through Result. The error value
 * is an array because all field errors from the record are collected
 * rather than stopping at the first.
 */
export function applyMapping(
    mapping: DatasetMapping,
    record: unknown
): Result<Record<string, unknown>, MappingFieldError[]> {
    const output: Record<string, unknown> = {};
    const errors: MappingFieldError[] = [];

    for (const field of mapping.fields) {
        const rawValue = field.transform?.kind === "join" ? undefined : getByPath(record, field.sourcePath);
        const transformed = applyTransform(field.transform, rawValue, record);

        if (!transformed.ok) {
            errors.push({ targetPath: field.targetPath, message: transformed.error });
            continue;
        }

        if (field.required && isBlank(transformed.data)) {
            errors.push({
                targetPath: field.targetPath,
                message: `"${field.sourcePath}" ist erforderlich, fehlt aber.`,
            });
            continue;
        }

        if (transformed.data === undefined) continue;

        if (!setByPath(output, field.targetPath, transformed.data)) {
            errors.push({
                targetPath: field.targetPath,
                message: `"${field.targetPath}" ist kein gültiger Zielpfad.`,
            });
        }
    }

    if (errors.length > 0) return err(errors);

    return ok(output);
}
