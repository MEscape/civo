import { z } from "zod";
import {
    err,
    ok,
    type Result,
} from "@/lib/result/result";

/**
 * Explicit, serializable field mapping from an external record's shape to
 * a canonical content field (Phase 3.5 spec §9, §28).
 *
 * This is deliberately NOT a programming language. `sourcePath` and
 * `targetPath` are dot/bracket paths resolved by getByPath/setByPath.
 *
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

export type TransformKind = z.infer<
    typeof transformKindSchema
>;

export const transformDefinitionSchema =
    z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("string"),
        }),

        z.object({
            kind: z.literal("number"),
        }),

        z.object({
            kind: z.literal("boolean"),
        }),

        z.object({
            kind: z.literal("date"),
        }),

        z.object({
            kind: z.literal("datetime"),
        }),

        z.object({
            kind: z.literal("url"),
        }),

        z.object({
            kind: z.literal("join"),
            sourcePaths: z
                .array(z.string().min(1))
                .min(1)
                .max(6),
            separator: z
                .string()
                .max(20)
                .default(", "),
        }),

        z.object({
            kind: z.literal("fallback"),
            value: z.union([
                z.string(),
                z.number(),
                z.boolean(),
            ]),
        }),
    ]);

export type TransformDefinition = z.infer<
    typeof transformDefinitionSchema
>;

/**
 * One field mapping.
 */
export const fieldMappingSchema = z.object({
    sourcePath: z.string().min(1).max(200),

    targetPath: z.string().min(1).max(200),

    transform: transformDefinitionSchema.optional(),

    required: z.boolean().default(false),
});

export type FieldMapping = z.infer<
    typeof fieldMappingSchema
>;

export const datasetMappingSchema = z.object({
    fields: z
        .array(fieldMappingSchema)
        .min(1)
        .max(50),
});

export type DatasetMapping = z.infer<
    typeof datasetMappingSchema
>;

/**
 * Canonical target fields offered by the mapping UI.
 */
export const CANONICAL_TARGET_FIELDS: Record<
    "civic" | "smartcity",
    {
        path: string;
        label: string;
        required?: boolean;
    }[]
> = {
    civic: [
        {
            path: "title",
            label: "Titel",
            required: true,
        },
        {
            path: "description",
            label: "Beschreibung",
        },
        {
            path: "startDate",
            label: "Startdatum",
            required: true,
        },
        {
            path: "endDate",
            label: "Enddatum",
        },
        {
            path: "location",
            label: "Ort",
        },
        {
            path: "category",
            label: "Kategorie",
        },
        {
            path: "imageUrl",
            label: "Bild-URL",
        },
    ],

    smartcity: [
        {
            path: "label",
            label: "Bezeichnung",
            required: true,
        },
        {
            path: "value",
            label: "Wert",
            required: true,
        },
        {
            path: "unit",
            label: "Einheit",
        },
        {
            path: "category",
            label: "Kategorie",
        },
    ],
};

/**
 * Reads a dot/bracket path from an unknown value.
 *
 * Example:
 *
 * getByPath(
 *     { location: { name: "Rathaus" } },
 *     "location.name"
 * );
 *
 * Returns undefined for any missing/invalid segment.
 */
export function getByPath(
    source: unknown,
    path: string
): unknown {
    const segments = path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);

    let current: unknown = source;

    for (const segment of segments) {
        if (
            current === null ||
            current === undefined ||
            typeof current !== "object"
        ) {
            return undefined;
        }

        current = (
            current as Record<string, unknown>
        )[segment];
    }

    return current;
}

/**
 * Writes a value to a dot path on a plain object.
 *
 * Target-side array indexes are intentionally not supported.
 */
function setByPath(
    target: Record<string, unknown>,
    path: string,
    value: unknown
): void {
    const segments = path
        .split(".")
        .filter(Boolean);

    if (segments.length === 0) {
        return;
    }

    let current = target;

    for (
        let i = 0;
        i < segments.length - 1;
        i++
    ) {
        const segment = segments[i];

        if (
            typeof current[segment] !== "object" ||
            current[segment] === null ||
            Array.isArray(current[segment])
        ) {
            current[segment] = {};
        }

        current = current[segment] as Record<
            string,
            unknown
        >;
    }

    current[segments[segments.length - 1]] =
        value;
}

/**
 * Structured failure from applying a single field mapping.
 */
export type MappingFieldError = {
    targetPath: string;
    message: string;
};

/**
 * Applies one fixed transform.
 *
 * All expected transform failures are represented by Result.
 * No expected input error throws.
 */
function applyTransform(
    transform: TransformDefinition | undefined,
    rawValue: unknown,
    record: unknown
): Result<unknown, string> {
    if (!transform) {
        return ok(rawValue);
    }

    switch (transform.kind) {
        case "string": {
            if (
                rawValue === undefined ||
                rawValue === null
            ) {
                return ok(undefined);
            }

            return ok(String(rawValue));
        }

        case "number": {
            if (
                rawValue === undefined ||
                rawValue === null ||
                rawValue === ""
            ) {
                return ok(undefined);
            }

            const num = Number(rawValue);

            if (Number.isNaN(num)) {
                return err(
                    `"${String(
                        rawValue
                    )}" is not a valid number.`
                );
            }

            return ok(num);
        }

        case "boolean": {
            if (
                rawValue === undefined ||
                rawValue === null
            ) {
                return ok(undefined);
            }

            if (typeof rawValue === "boolean") {
                return ok(rawValue);
            }

            if (rawValue === "true") {
                return ok(true);
            }

            if (rawValue === "false") {
                return ok(false);
            }

            return err(
                `"${String(
                    rawValue
                )}" is not a valid boolean.`
            );
        }

        case "date":
        case "datetime": {
            if (
                rawValue === undefined ||
                rawValue === null ||
                rawValue === ""
            ) {
                return ok(undefined);
            }

            const date = new Date(
                rawValue as string | number
            );

            if (Number.isNaN(date.getTime())) {
                return err(
                    `"${String(
                        rawValue
                    )}" is not a valid date.`
                );
            }

            return ok(date);
        }

        case "url": {
            if (
                rawValue === undefined ||
                rawValue === null ||
                rawValue === ""
            ) {
                return ok(undefined);
            }

            try {
                const url = new URL(
                    String(rawValue)
                );

                if (
                    url.protocol !== "http:" &&
                    url.protocol !== "https:"
                ) {
                    return err(
                        `"${String(
                            rawValue
                        )}" must be an http(s) URL.`
                    );
                }

                return ok(url.toString());
            } catch {
                return err(
                    `"${String(
                        rawValue
                    )}" is not a valid URL.`
                );
            }
        }

        case "join": {
            const parts = transform.sourcePaths
                .map((path) =>
                    getByPath(record, path)
                )
                .filter(
                    (value) =>
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                )
                .map(String);

            return ok(
                parts.length > 0
                    ? parts.join(
                        transform.separator
                    )
                    : undefined
            );
        }

        case "fallback": {
            if (
                rawValue === undefined ||
                rawValue === null ||
                rawValue === ""
            ) {
                return ok(transform.value);
            }

            return ok(rawValue);
        }
    }
}

/**
 * Applies a dataset's field mappings to one external record.
 *
 * Expected mapping/transform failures are returned through Result.
 *
 * The error value is an array because we intentionally collect all field
 * errors from the record rather than stopping at the first one.
 */
export function applyMapping(
    mapping: DatasetMapping,
    record: unknown
): Result<
    Record<string, unknown>,
    MappingFieldError[]
> {
    const output: Record<string, unknown> = {};
    const errors: MappingFieldError[] = [];

    for (const field of mapping.fields) {
        const rawValue =
            field.transform?.kind === "join"
                ? undefined
                : getByPath(
                    record,
                    field.sourcePath
                );

        const transformed = applyTransform(
            field.transform,
            rawValue,
            record
        );

        if (!transformed.ok) {
            errors.push({
                targetPath: field.targetPath,
                message: transformed.error,
            });

            continue;
        }

        if (
            field.required &&
            (transformed.data === undefined ||
                transformed.data === null ||
                transformed.data === "")
        ) {
            errors.push({
                targetPath: field.targetPath,
                message: `"${field.sourcePath}" is required but missing.`,
            });

            continue;
        }

        if (transformed.data !== undefined) {
            setByPath(
                output,
                field.targetPath,
                transformed.data
            );
        }
    }

    if (errors.length > 0) {
        return err(errors);
    }

    return ok(output);
}
