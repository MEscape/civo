import { describe, it, expect } from "vitest";

import {
    fieldMappingSchema,
    datasetMappingSchema,
    getByPath,
    applyMapping,
    CANONICAL_TARGET_FIELDS,
    type DatasetMapping,
} from "@/modules/data-sources/domain/field-mapping-schema";

describe("fieldMappingSchema", () => {
    it("accepts a minimal mapping with no transform", () => {
        const result = fieldMappingSchema.safeParse({
            sourcePath: "event_name",
            targetPath: "title",
        });

        expect(result.success).toBe(true);
    });

    it("rejects an unknown transform kind", () => {
        const result = fieldMappingSchema.safeParse({
            sourcePath: "a",
            targetPath: "b",
            transform: {
                kind: "eval",
            },
        });

        expect(result.success).toBe(false);
    });

    it("defaults required to false", () => {
        const result = fieldMappingSchema.safeParse({
            sourcePath: "a",
            targetPath: "b",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.required).toBe(false);
        }
    });
});

describe("getByPath", () => {
    it("reads a top-level field", () => {
        expect(
            getByPath(
                { title: "Stadtfest" },
                "title"
            )
        ).toBe("Stadtfest");
    });

    it("reads a nested field", () => {
        expect(
            getByPath(
                {
                    location: {
                        name: "Rathaus",
                    },
                },
                "location.name"
            )
        ).toBe("Rathaus");
    });

    it("reads an array index", () => {
        expect(
            getByPath(
                {
                    tags: ["a", "b"],
                },
                "tags[0]"
            )
        ).toBe("a");
    });

    it("returns undefined for a missing path rather than throwing", () => {
        expect(
            getByPath(
                { a: {} },
                "a.b.c"
            )
        ).toBeUndefined();
    });

    it("returns undefined when traversing through a primitive", () => {
        expect(
            getByPath(
                { a: "text" },
                "a.b"
            )
        ).toBeUndefined();
    });

    it("returns undefined for null/undefined source", () => {
        expect(
            getByPath(null, "a")
        ).toBeUndefined();

        expect(
            getByPath(undefined, "a")
        ).toBeUndefined();
    });
});

describe("applyMapping", () => {
    it("maps a flat external record to a nested canonical shape", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "event_name",
                    targetPath: "title",
                    required: true,
                },
                {
                    sourcePath: "venue",
                    targetPath: "location.name",
                    required: false,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {
                event_name: "Stadtfest",
                venue: "Marktplatz",
            }
        );

        expect(result).toEqual({
            ok: true,
            data: {
                title: "Stadtfest",
                location: {
                    name: "Marktplatz",
                },
            },
        });
    });

    it("fails a required field that is missing from the source record", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "event_name",
                    targetPath: "title",
                    required: true,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {
                other: "value",
            }
        );

        expect(result.ok).toBe(false);

        if (!result.ok) {
            expect(result.error).toEqual([
                {
                    targetPath: "title",
                    message:
                        '"event_name" ist erforderlich, fehlt aber.',
                },
            ]);
        }
    });

    it("omits an optional field that is missing from the source record", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "event_name",
                    targetPath: "title",
                    required: true,
                },
                {
                    sourcePath: "missing",
                    targetPath: "description",
                    required: false,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {
                event_name: "Stadtfest",
            }
        );

        expect(result).toEqual({
            ok: true,
            data: {
                title: "Stadtfest",
            },
        });
    });

    it("applies a date transform and rejects an invalid date value", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "start",
                    targetPath: "startDate",
                    transform: {
                        kind: "date",
                    },
                    required: true,
                },
            ],
        };

        const success = applyMapping(
            mapping,
            {
                start: "2026-09-20T18:00:00",
            }
        );

        expect(success.ok).toBe(true);

        if (success.ok) {
            expect(
                success.data.startDate
            ).toBeInstanceOf(Date);
        }

        const failure = applyMapping(
            mapping,
            {
                start: "not-a-date",
            }
        );

        expect(failure.ok).toBe(false);

        if (!failure.ok) {
            expect(failure.error).toEqual([
                {
                    targetPath: "startDate",
                    message:
                        '"not-a-date" ist kein gültiges Datum.',
                },
            ]);
        }
    });

    it("applies a url transform and rejects a non-http(s) scheme", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "link",
                    targetPath: "url",
                    transform: {
                        kind: "url",
                    },
                    required: false,
                },
            ],
        };

        const success = applyMapping(
            mapping,
            {
                link: "https://example.de/events/1",
            }
        );

        expect(success).toEqual({
            ok: true,
            data: {
                url: "https://example.de/events/1",
            },
        });

        const failure = applyMapping(
            mapping,
            {
                link: "javascript:alert(1)",
            }
        );

        expect(failure.ok).toBe(false);
    });

    it("joins multiple source paths with a separator", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "unused",
                    targetPath:
                        "location.address",
                    transform: {
                        kind: "join",
                        sourcePaths: [
                            "street",
                            "city",
                        ],
                        separator: ", ",
                    },
                    required: false,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {
                street: "Marktplatz 1",
                city: "Musterstadt",
            }
        );

        expect(result).toEqual({
            ok: true,
            data: {
                location: {
                    address:
                        "Marktplatz 1, Musterstadt",
                },
            },
        });
    });

    it("uses the fallback value when the source is missing", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "category",
                    targetPath: "category",
                    transform: {
                        kind: "fallback",
                        value: "Allgemein",
                    },
                    required: false,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {}
        );

        expect(result).toEqual({
            ok: true,
            data: {
                category: "Allgemein",
            },
        });
    });

    it("collects multiple field errors from a single record instead of stopping at the first", () => {
        const mapping: DatasetMapping = {
            fields: [
                {
                    sourcePath: "a",
                    targetPath: "startDate",
                    transform: {
                        kind: "date",
                    },
                    required: true,
                },
                {
                    sourcePath: "b",
                    targetPath: "endDate",
                    transform: {
                        kind: "date",
                    },
                    required: true,
                },
            ],
        };

        const result = applyMapping(
            mapping,
            {
                a: "not-a-date",
                b: "also-not-a-date",
            }
        );

        expect(result.ok).toBe(false);

        if (!result.ok) {
            expect(result.error).toHaveLength(2);
        }
    });
});

describe("datasetMappingSchema", () => {
    it("rejects an empty fields array", () => {
        expect(
            datasetMappingSchema.safeParse({
                fields: [],
            }).success
        ).toBe(false);
    });
});


describe("path safety (prototype pollution)", () => {
    it("rejects a __proto__ target path at the schema level", () => {
        const result = fieldMappingSchema.safeParse({
            sourcePath: "a",
            targetPath: "__proto__.polluted",
        });

        expect(result.success).toBe(false);
    });

    it("rejects constructor.prototype target paths at the schema level", () => {
        expect(
            fieldMappingSchema.safeParse({ sourcePath: "a", targetPath: "constructor.prototype.x" }).success
        ).toBe(false);
    });

    it("rejects a forbidden segment in a source path", () => {
        expect(fieldMappingSchema.safeParse({ sourcePath: "__proto__.x", targetPath: "title" }).success).toBe(false);
    });

    it("rejects target paths with array indexes or unusual characters", () => {
        for (const targetPath of ["tags[0]", "a..b", ".a", "a b", "a-b", "1abc"]) {
            expect(fieldMappingSchema.safeParse({ sourcePath: "a", targetPath }).success).toBe(false);
        }
    });

    it("rejects an overly deep target path", () => {
        expect(fieldMappingSchema.safeParse({ sourcePath: "a", targetPath: "a.b.c.d.e.f" }).success).toBe(false);
    });

    it("does not pollute Object.prototype even when an unvalidated mapping reaches applyMapping", () => {
        // A mapping persisted before the schema-level check existed bypasses
        // Zod entirely, so applyMapping must defend itself.
        const unvalidated = {
            fields: [{ sourcePath: "a", targetPath: "__proto__.polluted", required: false }],
        } as DatasetMapping;

        const result = applyMapping(unvalidated, { a: "x" });

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(result.ok).toBe(false);
    });

    it("does not pollute via constructor.prototype either", () => {
        const unvalidated = {
            fields: [{ sourcePath: "a", targetPath: "constructor.prototype.polluted", required: false }],
        } as DatasetMapping;

        applyMapping(unvalidated, { a: "x" });

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("does not read inherited properties from a source record", () => {
        expect(getByPath({}, "constructor")).toBeUndefined();
        expect(getByPath({}, "toString")).toBeUndefined();
        expect(getByPath({ a: 1 }, "__proto__")).toBeUndefined();
    });
});

describe("datasetMappingSchema target uniqueness", () => {
    it("rejects two fields mapped to the same target", () => {
        const result = datasetMappingSchema.safeParse({
            fields: [
                { sourcePath: "a", targetPath: "title" },
                { sourcePath: "b", targetPath: "title" },
            ],
        });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toMatch(/wurde bereits/i);
            expect(result.error.issues[0]?.path).toEqual(["fields", 1, "targetPath"]);
        }
    });

    it("rejects a parent target combined with one of its children", () => {
        expect(
            datasetMappingSchema.safeParse({
                fields: [
                    { sourcePath: "a", targetPath: "location" },
                    { sourcePath: "b", targetPath: "location.name" },
                ],
            }).success
        ).toBe(false);

        expect(
            datasetMappingSchema.safeParse({
                fields: [
                    { sourcePath: "a", targetPath: "location.name" },
                    { sourcePath: "b", targetPath: "location" },
                ],
            }).success
        ).toBe(false);
    });

    it("accepts sibling targets that only share a name prefix", () => {
        expect(
            datasetMappingSchema.safeParse({
                fields: [
                    { sourcePath: "a", targetPath: "location" },
                    { sourcePath: "b", targetPath: "locationNote" },
                ],
            }).success
        ).toBe(true);
    });

    it("accepts distinct sibling children of the same parent", () => {
        expect(
            datasetMappingSchema.safeParse({
                fields: [
                    { sourcePath: "a", targetPath: "location.name" },
                    { sourcePath: "b", targetPath: "location.zip" },
                ],
            }).success
        ).toBe(true);
    });
});

describe("CANONICAL_TARGET_FIELDS", () => {
    it("exposes only paths and required flags, leaving labels to the presentation layer", () => {
        for (const fields of Object.values(CANONICAL_TARGET_FIELDS)) {
            for (const field of fields) {
                expect(Object.keys(field).sort()).toEqual(["path", "required"]);
            }
        }
    });

    it("only offers targets that are themselves valid target paths", () => {
        for (const fields of Object.values(CANONICAL_TARGET_FIELDS)) {
            for (const field of fields) {
                expect(fieldMappingSchema.safeParse({ sourcePath: "x", targetPath: field.path }).success).toBe(true);
            }
        }
    });
});
