import { describe, expect, it } from "vitest";
import { applyMigrationPlan, type ConflictResolutions } from "@/modules/migration/domain/apply-migration";
import type { MigrationPlan, NodeMigrationPlan } from "@/modules/migration/domain/migration-plan";
import type { PageConfig } from "@/modules/builder/domain/page-node";

function nodePlan(overrides: Partial<NodeMigrationPlan>): NodeMigrationPlan {
    return {
        nodeId: "n1",
        type: "widget",
        fromVersion: 1,
        toVersion: 2,
        status: "upgradable",
        conflicts: [],
        addedFields: [],
        ...overrides,
    };
}

function planWith(nodes: NodeMigrationPlan[], path = ""): MigrationPlan {
    return {
        pages: [{ path, nodes }],
        requiresReview: nodes.some((n) => n.status === "needs-review" || n.status === "unresolvable"),
        isUpToDate: nodes.every((n) => n.status === "unchanged"),
    };
}

function pageWith(children: PageConfig["children"], path = ""): { path: string; config: PageConfig } {
    return { path, config: { type: "page", children } };
}

describe("applyMigrationPlan", () => {
    it("applies an upgradable node's merged props with no resolutions needed", () => {
        const plan = planWith([nodePlan({ status: "upgradable", mergedProps: { columns: 4 } })]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }])];

        const result = applyMigrationPlan(plan, pages);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 4 });
        expect(result.updatedNodeIds).toEqual(["n1"]);
        expect(result.skippedNodeIds).toEqual([]);
    });

    it("leaves an unchanged node's props completely untouched", () => {
        const plan = planWith([nodePlan({ status: "unchanged", mergedProps: undefined })]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }])];

        const result = applyMigrationPlan(plan, pages);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 3 });
        expect(result.updatedNodeIds).toEqual([]);
    });

    it("leaves an unresolvable node's props completely untouched", () => {
        const plan = planWith([nodePlan({ status: "unresolvable", mergedProps: undefined })]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }])];

        const result = applyMigrationPlan(plan, pages);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 3 });
        expect(result.updatedNodeIds).toEqual([]);
    });

    it("skips a needs-review node entirely when no resolution is provided for its conflict", () => {
        const plan = planWith([
            nodePlan({
                status: "needs-review",
                mergedProps: { columns: 2 },
                conflicts: [{ key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 }],
            }),
        ]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 2 } }])];

        const result = applyMigrationPlan(plan, pages); // no resolutions

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 2 }); // untouched original
        expect(result.updatedNodeIds).toEqual([]);
        expect(result.skippedNodeIds).toEqual(["n1"]);
    });

    it("applies a needs-review node when every conflict has a resolution: keep-local", () => {
        const plan = planWith([
            nodePlan({
                status: "needs-review",
                mergedProps: { columns: 2, heading: "Musterstadt" },
                conflicts: [{ key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 }],
            }),
        ]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 2, heading: "Musterstadt" } }])];
        const resolutions: ConflictResolutions = { n1: { columns: { action: "keep-local" } } };

        const result = applyMigrationPlan(plan, pages, resolutions);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 2, heading: "Musterstadt" });
        expect(result.updatedNodeIds).toEqual(["n1"]);
    });

    it("applies a needs-review node's conflict resolution: use-new", () => {
        const plan = planWith([
            nodePlan({
                status: "needs-review",
                mergedProps: { columns: 2 },
                conflicts: [{ key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 }],
            }),
        ]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 2 } }])];
        const resolutions: ConflictResolutions = { n1: { columns: { action: "use-new" } } };

        const result = applyMigrationPlan(plan, pages, resolutions);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 4 });
    });

    it("applies a needs-review node's conflict resolution: custom value", () => {
        const plan = planWith([
            nodePlan({
                status: "needs-review",
                mergedProps: { columns: 2 },
                conflicts: [{ key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 }],
            }),
        ]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 2 } }])];
        const resolutions: ConflictResolutions = { n1: { columns: { action: "custom", value: 5 } } };

        const result = applyMigrationPlan(plan, pages, resolutions);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 5 });
    });

    it("skips a node with two conflicts when only one has a resolution", () => {
        const plan = planWith([
            nodePlan({
                status: "needs-review",
                mergedProps: { columns: 2, limit: 6 },
                conflicts: [
                    { key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 },
                    { key: "limit", case: "conflict", base: 6, local: 8, incoming: 10 },
                ],
            }),
        ]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 2, limit: 8 } }])];
        const resolutions: ConflictResolutions = { n1: { columns: { action: "keep-local" } } }; // "limit" left unresolved

        const result = applyMigrationPlan(plan, pages, resolutions);

        expect(result.pages[0]?.config.children[0]?.props).toEqual({ columns: 2, limit: 8 }); // untouched original
        expect(result.skippedNodeIds).toEqual(["n1"]);
    });

    it("never touches the tree structure — node order, ids, and nesting stay exactly as given", () => {
        const plan = planWith([nodePlan({ nodeId: "n2", status: "upgradable", mergedProps: { columns: 4 } })]);
        const pages = [
            pageWith([
                { id: "n1", type: "hero", props: { heading: "Hi" } },
                {
                    id: "container",
                    type: "section",
                    props: {},
                    children: [{ id: "n2", type: "widget", props: { columns: 3 } }],
                },
            ]),
        ];

        const result = applyMigrationPlan(plan, pages);

        const [hero, section] = result.pages[0]!.config.children;
        expect(hero).toEqual({ id: "n1", type: "hero", props: { heading: "Hi" } });
        expect(section?.id).toBe("container");
        expect(section?.children?.[0]).toEqual({ id: "n2", type: "widget", props: { columns: 4 } });
    });

    it("passes through a node with no plan at all untouched, but still recurses into its children", () => {
        const plan = planWith([nodePlan({ nodeId: "n2", status: "upgradable", mergedProps: { columns: 4 } })]);
        const pages = [
            pageWith([
                {
                    id: "container", // no plan exists for "container" itself
                    type: "section",
                    props: { fullWidth: true },
                    children: [{ id: "n2", type: "widget", props: { columns: 3 } }],
                },
            ]),
        ];

        const result = applyMigrationPlan(plan, pages);

        const section = result.pages[0]!.config.children[0];
        expect(section?.props).toEqual({ fullWidth: true }); // untouched
        expect(section?.children?.[0]?.props).toEqual({ columns: 4 }); // child still migrated
    });

    it("matches pages by path independently, leaving an unrelated page's plan-less nodes untouched", () => {
        const plan: MigrationPlan = {
            pages: [{ path: "home", nodes: [nodePlan({ status: "upgradable", mergedProps: { columns: 4 } })] }],
            requiresReview: false,
            isUpToDate: false,
        };
        const pages = [
            pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }], "home"),
            pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }], "about"), // same node id, different page — no plan
        ];

        const result = applyMigrationPlan(plan, pages);

        expect(result.pages.find((p) => p.path === "home")?.config.children[0]?.props).toEqual({ columns: 4 });
        expect(result.pages.find((p) => p.path === "about")?.config.children[0]?.props).toEqual({ columns: 3 });
    });

    it("returns empty updatedNodeIds when nothing in the plan requires a change", () => {
        const plan = planWith([nodePlan({ status: "unchanged", mergedProps: undefined })]);
        const pages = [pageWith([{ id: "n1", type: "widget", props: { columns: 3 } }])];

        const result = applyMigrationPlan(plan, pages);

        expect(result.updatedNodeIds).toEqual([]);
    });
});
