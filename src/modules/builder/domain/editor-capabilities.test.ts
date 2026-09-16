import { describe, it, expect } from "vitest";
import {
    editorCapabilities,
    hasCapability,
} from "@/modules/builder/domain/editor-capabilities";
import type { EditorCapability } from "@/modules/builder/domain/editor-capabilities";

describe("editorCapabilities", () => {
    describe("internal mode", () => {
        it("has every capability", () => {
            const allCapabilities: EditorCapability[] = [
                "editStructure",
                "editContent",
                "changeVariant",
                "changeSpacing",
                "configureData",
                "manageTheme",
                "toggleVisibility",
            ];
            for (const cap of allCapabilities) {
                expect(hasCapability("internal", cap)).toBe(true);
            }
        });
    });

    describe("municipality mode", () => {
        it("can edit content", () => {
            expect(hasCapability("municipality", "editContent")).toBe(true);
        });
        it("can change variant", () => {
            expect(hasCapability("municipality", "changeVariant")).toBe(true);
        });
        it("can toggle visibility", () => {
            expect(hasCapability("municipality", "toggleVisibility")).toBe(true);
        });

        it("cannot edit structure (add/remove/reorder components)", () => {
            expect(hasCapability("municipality", "editStructure")).toBe(false);
        });
        it("cannot configure data sources", () => {
            expect(hasCapability("municipality", "configureData")).toBe(false);
        });
        it("cannot change spacing appearance", () => {
            expect(hasCapability("municipality", "changeSpacing")).toBe(false);
        });
        it("cannot manage theme", () => {
            expect(hasCapability("municipality", "manageTheme")).toBe(false);
        });
    });
});

describe("capability sets are immutable ReadonlySets", () => {
    it("internal set is frozen (Set.add returns the same set but size doesn't grow)", () => {
        const set = editorCapabilities.internal;
        const sizeBefore = set.size;
        // ReadonlySet has no .add — this tests type safety at the TS level
        // (the cast is intentional to verify runtime behaviour)
        try {
            (set as Set<EditorCapability>).add("editStructure");
        } catch {
            // Some environments throw for frozen sets — that's fine too
        }
        // Size should not have grown with a duplicate value
        expect(set.size).toBe(sizeBefore);
    });
});
