import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractComponentDependencies, mergeComponentDependencies } from "@/modules/release/domain/dependency-graph";
import { registerComponentDefinitions } from "@/modules/component-platform/domain";
import type { PageConfigInput } from "@/modules/builder/domain/page-schema";

// vitest.setup.ts registers the real component registry globally, so
// "hero"/"section" etc. resolve without any setup here. This file's own
// fabricated component below uses a type name that cannot collide with
// any real one, so it is registered once and never needs to be torn
// down — domain/** test files must not import
// component-platform/infrastructure/definitions.ts themselves (that
// aggregation step is infrastructure/**, not domain/**; see that file's
// own comment), so unlike release-service.test.ts (an infrastructure/**
// test, which can and does restore the real registry after clearing it)
// this file never clears the registry at all.

describe("extractComponentDependencies", () => {
    it("returns an empty array for a page with no nodes", () => {
        const config: PageConfigInput = { type: "page", children: [] };
        expect(extractComponentDependencies(config)).toEqual([]);
    });

    it("resolves the current version and declared contracts of a real component", () => {
        const config: PageConfigInput = {
            type: "page",
            children: [{ id: "n1", type: "eventsGrid", props: {} }],
        };
        const result = extractComponentDependencies(config);
        expect(result).toEqual([{ type: "eventsGrid", version: 1, contracts: [] }]);
    });

    it("skips a node whose type is not registered", () => {
        const config: PageConfigInput = {
            type: "page",
            children: [{ id: "n1", type: "totallyUnregistered", props: {} }],
        };
        expect(extractComponentDependencies(config)).toEqual([]);
    });

    it("includes one entry per distinct type even when used multiple times", () => {
        const config: PageConfigInput = {
            type: "page",
            children: [
                { id: "n1", type: "hero", props: {} },
                { id: "n2", type: "hero", props: {} },
                { id: "n3", type: "richText", props: {} },
            ],
        };
        const result = extractComponentDependencies(config);
        expect(result.map((d) => d.type).sort()).toEqual(["hero", "richText"]);
    });

    it("finds nodes nested inside container children, not just top-level nodes", () => {
        const config: PageConfigInput = {
            type: "page",
            children: [
                {
                    id: "section-1",
                    type: "section",
                    props: {},
                    children: [{ id: "n1", type: "hero", props: {} }],
                },
            ],
        };
        const result = extractComponentDependencies(config);
        expect(result.map((d) => d.type).sort()).toEqual(["hero", "section"]);
    });

    describe("with a fabricated versioned/contract-dependent component", () => {
        it("resolves a non-default version and carries declared contract dependencies through", () => {
            registerComponentDefinitions([
                {
                    type: "futureWidget",
                    version: 3,
                    label: "Future Widget",
                    category: "civic",
                    description: "Fabricated for this test.",
                    canHaveChildren: false,
                    createDefaultNode: () => ({ id: "n1", type: "futureWidget", props: {} }),
                    propsSchema: z.object({}),
                    fields: [],
                    dependsOnContracts: [{ contract: "CivicEvent", minVersion: 2 }],
                },
            ]);

            const config: PageConfigInput = {
                type: "page",
                children: [{ id: "n1", type: "futureWidget", props: {} }],
            };
            const result = extractComponentDependencies(config);

            expect(result).toEqual([
                { type: "futureWidget", version: 3, contracts: [{ contract: "CivicEvent", minVersion: 2 }] },
            ]);
        });
    });
});

describe("mergeComponentDependencies", () => {
    it("returns an empty array when there are no pages", () => {
        expect(mergeComponentDependencies([])).toEqual([]);
    });

    it("deduplicates the same component type appearing on multiple pages", () => {
        const dep = { type: "eventsGrid", version: 1, contracts: [] };
        const result = mergeComponentDependencies([[dep], [dep]]);
        expect(result).toEqual([dep]);
    });

    it("combines distinct component types from different pages into one list", () => {
        const homeDep = { type: "hero", version: 1, contracts: [] };
        const eventsDep = { type: "eventsGrid", version: 1, contracts: [] };
        const result = mergeComponentDependencies([[homeDep], [eventsDep]]);
        expect(result.map((d) => d.type).sort()).toEqual(["eventsGrid", "hero"]);
    });
});
