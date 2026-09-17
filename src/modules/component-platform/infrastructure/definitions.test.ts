import { describe, it, expect } from "vitest";
import {
    getComponentDefinition,
    tryGetComponentDefinition,
    canInsertChild,
    isRegisteredComponentType,
} from "@/modules/component-platform/domain";
import { componentDefinitions } from "@/modules/component-platform/infrastructure/definitions";

/**
 * Lives in `infrastructure/**`, not `domain/**`, because it exercises the
 * fully-assembled, real component definitions (hero, newsGrid, section,
 * …) — which only exist once `infrastructure/definitions.ts` has
 * registered them (see that file's own comment on why the aggregation
 * step cannot live in `domain/**`). Pure registry-mechanics tests that
 * don't need concrete definitions belong in `domain/registry.test.ts`.
 */

describe("componentDefinitions", () => {
    it("every definition's createDefaultNode produces props that pass its own schema", () => {
        for (const definition of componentDefinitions) {
            const node = definition.createDefaultNode();
            const result = definition.propsSchema.safeParse(node.props);
            expect(result.success, `${definition.type} default props should be valid`).toBe(true);
        }
    });

    it("every definition's createDefaultNode produces a node whose type matches the registry key", () => {
        for (const definition of componentDefinitions) {
            const node = definition.createDefaultNode();
            expect(node.type).toBe(definition.type);
        }
    });

    it("createDefaultNode generates a fresh id on every call", () => {
        const definition = getComponentDefinition("hero")!;
        const first = definition.createDefaultNode();
        const second = definition.createDefaultNode();
        expect(first.id).not.toBe(second.id);
    });

    it("rejects invalid props for a schema with constraints (newsGrid.limit out of range)", () => {
        const definition = getComponentDefinition("newsGrid")!;
        const result = definition.propsSchema.safeParse({ columns: 3, limit: 999 });
        expect(result.success).toBe(false);
    });

    it("accepts partial props and fills in defaults", () => {
        const definition = getComponentDefinition("newsGrid")!;
        const result = definition.propsSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as { columns: number; heading: string };
            expect(data.columns).toBe(3);
            expect(data.heading).toBe("Aktuelles");
        }
    });

    it("has no duplicate type strings across all definitions", () => {
        const types = componentDefinitions.map((d) => d.type);
        expect(new Set(types).size).toBe(types.length);
    });
});

describe("isRegisteredComponentType", () => {
    it("returns true for a known type", () => {
        expect(isRegisteredComponentType("hero")).toBe(true);
    });

    it("returns false for an unknown type", () => {
        expect(isRegisteredComponentType("totally-made-up")).toBe(false);
    });
});

describe("tryGetComponentDefinition", () => {
    it("returns the definition for a known type", () => {
        expect(tryGetComponentDefinition("hero")?.type).toBe("hero");
    });

    it("returns undefined (does not throw) for an unknown type", () => {
        expect(tryGetComponentDefinition("totally-made-up")).toBeUndefined();
    });
});

describe("canInsertChild", () => {
    it("allows any registered type at the root (null parent)", () => {
        expect(canInsertChild(null, "hero")).toBe(true);
        expect(canInsertChild(null, "newsGrid")).toBe(true);
    });

    it("rejects an unregistered child type anywhere", () => {
        expect(canInsertChild(null, "not-a-real-type")).toBe(false);
        expect(canInsertChild("section", "not-a-real-type")).toBe(false);
    });

    it("allows inserting into a container type (section)", () => {
        expect(canInsertChild("section", "hero")).toBe(true);
        expect(canInsertChild("section", "newsGrid")).toBe(true);
    });

    it("rejects inserting into a non-container type (hero cannot have children)", () => {
        expect(canInsertChild("hero", "richText")).toBe(false);
    });

    it("rejects inserting into an unknown parent type", () => {
        expect(canInsertChild("not-a-real-type", "hero")).toBe(false);
    });
});
