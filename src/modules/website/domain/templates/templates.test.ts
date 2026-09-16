import { describe, it, expect } from "vitest";
import { getTemplate, listTemplates } from "./index";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { collectNodeIds } from "@/modules/builder/domain/page-node";

describe("templates", () => {
    it("lists all three MVP templates", () => {
        const templates = listTemplates();
        expect(templates.map((t) => t.key).sort()).toEqual(["association", "municipal", "smart-city"]);
    });

    it("returns undefined for an unknown template key", () => {
        // @ts-expect-error intentionally testing an invalid key
        expect(getTemplate("does-not-exist")).toBeUndefined();
    });

    for (const key of ["municipal", "smart-city", "association"] as const) {
        it(`"${key}" template generates a page config valid against pageConfigSchema`, () => {
            const template = getTemplate(key);
            expect(template).toBeDefined();
            const config = template!.generateHomePageConfig();
            const result = pageConfigSchema.safeParse(config);
            expect(result.success).toBe(true);
        });

        it(`"${key}" template generates nodes with unique, stable ids`, () => {
            const template = getTemplate(key)!;
            const config = template.generateHomePageConfig();
            const ids = collectNodeIds(config.children);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it(`"${key}" template generates the same config shape on repeated calls`, () => {
            const template = getTemplate(key)!;
            const first = template.generateHomePageConfig();
            const second = template.generateHomePageConfig();
            // Independence guarantee: each call produces a fresh,
            // structurally-equal-but-distinct object — instantiating a website
            // never shares a mutable reference back to the template definition.
            expect(first).toEqual(second);
            expect(first).not.toBe(second);
            expect(first.children).not.toBe(second.children);
        });
    }
});
