import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import type { ComponentDefinition } from "./types";
import {
    componentDefinitionRegistry,
    registerComponentDefinitions,
    isRegisteredComponentType,
    getComponentDefinition,
    tryGetComponentDefinition,
    canInsertChild,
} from "./registry";

/**
 * Pure registry-mechanics tests: registration, duplicate detection,
 * lookup, and child-insertion rules, using small fabricated definitions
 * rather than the platform's real components. This is what lets these
 * tests live in `domain/**` without depending on
 * `infrastructure/definitions.ts` (which only exists to aggregate real,
 * UI-coupled feature-module definitions — see that file's comment).
 * End-to-end coverage of the real, fully-assembled registry lives in
 * `infrastructure/definitions.test.ts`.
 */

function makeDefinition(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
    return {
        type: "testLeaf",
        label: "Test Leaf",
        category: "content",
        description: "A fabricated leaf component for registry tests.",
        canHaveChildren: false,
        createDefaultNode: () => ({ id: "test-1", type: "testLeaf", props: {} }),
        propsSchema: z.object({}),
        fields: [],
        ...overrides,
    };
}

describe("registerComponentDefinitions", () => {
    beforeEach(() => {
        componentDefinitionRegistry.clear();
    });

    it("registers a definition and makes it queryable", () => {
        const def = makeDefinition({ type: "widgetA" });
        registerComponentDefinitions([def]);
        expect(isRegisteredComponentType("widgetA")).toBe(true);
        expect(getComponentDefinition("widgetA")).toBe(def);
    });

    it("registers multiple batches from different calls without conflict", () => {
        registerComponentDefinitions([makeDefinition({ type: "widgetA" })]);
        registerComponentDefinitions([makeDefinition({ type: "widgetB" })]);
        expect(isRegisteredComponentType("widgetA")).toBe(true);
        expect(isRegisteredComponentType("widgetB")).toBe(true);
    });

    it("throws when two DIFFERENT definitions share a type string", () => {
        registerComponentDefinitions([makeDefinition({ type: "widgetA" })]);
        expect(() =>
            registerComponentDefinitions([makeDefinition({ type: "widgetA", label: "Different" })])
        ).toThrow(/Duplicate component type/);
    });

    it("is idempotent when the exact same definition object is registered twice", () => {
        const def = makeDefinition({ type: "widgetA" });
        registerComponentDefinitions([def]);
        expect(() => registerComponentDefinitions([def])).not.toThrow();
    });
});

describe("getComponentDefinition", () => {
    beforeEach(() => {
        componentDefinitionRegistry.clear();
    });

    it("throws for an unknown type (structural error, not a user-facing one)", () => {
        expect(() => getComponentDefinition("nope")).toThrow(/Unknown component type/);
    });
});

describe("tryGetComponentDefinition", () => {
    beforeEach(() => {
        componentDefinitionRegistry.clear();
    });

    it("returns undefined instead of throwing for an unknown type", () => {
        expect(tryGetComponentDefinition("nope")).toBeUndefined();
    });
});

describe("canInsertChild", () => {
    beforeEach(() => {
        componentDefinitionRegistry.clear();
        registerComponentDefinitions([
            makeDefinition({ type: "container", canHaveChildren: true }),
            makeDefinition({ type: "restrictedContainer", canHaveChildren: true, acceptsChildTypes: ["leafA"] }),
            makeDefinition({ type: "leafA", canHaveChildren: false }),
            makeDefinition({ type: "leafB", canHaveChildren: false }),
        ]);
    });

    it("allows any registered type at the root (null parent)", () => {
        expect(canInsertChild(null, "leafA")).toBe(true);
    });

    it("rejects an unregistered child type anywhere", () => {
        expect(canInsertChild(null, "unregistered")).toBe(false);
        expect(canInsertChild("container", "unregistered")).toBe(false);
    });

    it("rejects an unregistered parent type", () => {
        expect(canInsertChild("unregistered", "leafA")).toBe(false);
    });

    it("rejects inserting into a parent that cannot have children", () => {
        expect(canInsertChild("leafA", "leafB")).toBe(false);
    });

    it("allows any registered child when the parent has no acceptsChildTypes restriction", () => {
        expect(canInsertChild("container", "leafA")).toBe(true);
        expect(canInsertChild("container", "leafB")).toBe(true);
    });

    it("restricts to acceptsChildTypes when the parent declares it", () => {
        expect(canInsertChild("restrictedContainer", "leafA")).toBe(true);
        expect(canInsertChild("restrictedContainer", "leafB")).toBe(false);
    });
});
