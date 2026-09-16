import { describe, it, expect } from "vitest";
import { pageConfigSchema, pageNodeSchema } from "@/modules/builder/domain/page-schema";

describe("pageNodeSchema", () => {
    it("accepts a minimal valid node", () => {
        const result = pageNodeSchema.safeParse({ id: "n1", type: "hero", props: { title: "Hi" } });
        expect(result.success).toBe(true);
    });

    it("rejects a node without an id", () => {
        const result = pageNodeSchema.safeParse({ type: "hero", props: {} });
        expect(result.success).toBe(false);
    });

    it("rejects a node without a type", () => {
        const result = pageNodeSchema.safeParse({ id: "n1", props: {} });
        expect(result.success).toBe(false);
    });

    it("accepts nested children", () => {
        const result = pageNodeSchema.safeParse({
            id: "root",
            type: "section",
            props: {},
            children: [{ id: "child", type: "hero", props: {} }],
        });
        expect(result.success).toBe(true);
    });
});

describe("pageConfigSchema", () => {
    it("accepts a valid page config", () => {
        const result = pageConfigSchema.safeParse({
            type: "page",
            children: [
                { id: "hero-1", type: "hero", props: { title: "Willkommen" } },
                { id: "news-1", type: "newsGrid", props: { columns: 3 } },
            ],
        });
        expect(result.success).toBe(true);
    });

    it("rejects a config with duplicate top-level node ids", () => {
        const result = pageConfigSchema.safeParse({
            type: "page",
            children: [
                { id: "dup", type: "hero", props: {} },
                { id: "dup", type: "newsGrid", props: {} },
            ],
        });
        expect(result.success).toBe(false);
    });

    it("rejects a config with duplicate ids across nesting levels", () => {
        const result = pageConfigSchema.safeParse({
            type: "page",
            children: [
                {
                    id: "section-1",
                    type: "section",
                    props: {},
                    children: [{ id: "section-1", type: "hero", props: {} }],
                },
            ],
        });
        expect(result.success).toBe(false);
    });

    it("rejects a config with the wrong root type", () => {
        const result = pageConfigSchema.safeParse({ type: "not-a-page", children: [] });
        expect(result.success).toBe(false);
    });

    it("accepts an empty page", () => {
        const result = pageConfigSchema.safeParse({ type: "page", children: [] });
        expect(result.success).toBe(true);
    });
});
