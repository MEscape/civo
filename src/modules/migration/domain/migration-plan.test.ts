import { describe, expect, it } from "vitest";
import { z } from "zod";
import { planMigration } from "@/modules/migration/domain/migration-plan";
import { registerComponentDefinitions } from "@/modules/component-platform/domain";
import type { ReleaseSnapshot } from "@/modules/release/domain/release-snapshot";

// vitest.setup.ts registers the real registry globally, so "hero" etc.
// resolve without any setup here. The fabricated "migratableWidget" type
// below cannot collide with any real component, so — like
// dependency-graph.test.ts — this file registers versions of it once
// and never clears the registry (domain/** test files must not import
// component-platform/infrastructure/definitions.ts to restore it; that
// aggregation step is infrastructure/**, not domain/**).

function baseSnapshot(overrides: Partial<ReleaseSnapshot> = {}): ReleaseSnapshot {
    return {
        schemaVersion: 1,
        website: { id: "website-1", name: "Site", slug: "site", description: null },
        theme: {
            primaryColor: "#024B6D",
            secondaryColor: "#577A8C",
            accentColor: "#D14900",
            headingFont: "Inter",
            bodyFont: "Inter",
            radius: "md",
            spacingScale: "comfortable",
        },
        pages: [],
        dependencies: [],
        ...overrides,
    };
}

describe("planMigration", () => {
    it("returns isUpToDate for a snapshot with no pages using any versioned dependency", () => {
        const plan = planMigration(baseSnapshot());
        expect(plan.isUpToDate).toBe(true);
        expect(plan.requiresReview).toBe(false);
    });

    it("marks a node unchanged when its recorded version matches the currently registered version", () => {
        const plan = planMigration(
            baseSnapshot({
                pages: [
                    {
                        path: "",
                        title: "Home",
                        config: { type: "page", children: [{ id: "n1", type: "hero", props: {} }] },
                    },
                ],
                dependencies: [{ type: "hero", version: 1, contracts: [] }],
            })
        );
        expect(plan.pages[0]?.nodes).toEqual([
            expect.objectContaining({ nodeId: "n1", type: "hero", status: "unchanged", fromVersion: 1, toVersion: 1 }),
        ]);
        expect(plan.isUpToDate).toBe(true);
    });

    it("skips a node whose type has no recorded dependency entry at all", () => {
        const plan = planMigration(
            baseSnapshot({
                pages: [
                    {
                        path: "",
                        title: "Home",
                        config: { type: "page", children: [{ id: "n1", type: "hero", props: {} }] },
                    },
                ],
                dependencies: [], // "hero" was never recorded
            })
        );
        expect(plan.pages[0]?.nodes).toEqual([]);
    });

    describe("with a fabricated multi-version component", () => {
        function widgetDef(type: string, version: number, defaultProps: Record<string, unknown>) {
            return {
                type,
                version,
                label: `${type} v${version}`,
                category: "civic" as const,
                description: "Fabricated for this test.",
                canHaveChildren: false,
                createDefaultNode: () => ({ id: "template", type, props: defaultProps }),
                propsSchema: z.object({}),
                fields: [],
            };
        }

        it("produces an upgradable plan with the merged props when there are no conflicts", () => {
            const type = "migratableWidgetUpgradable";
            registerComponentDefinitions([
                widgetDef(type, 1, { heading: "Termine", columns: 3 }),
                // Developer left `heading`'s default alone in v2 (BASE===NEW
                // for heading), only added a genuinely new field — this
                // keeps the fixture a clean Case 2 + added-field scenario,
                // not an incidental Case 4 on `heading` too.
                widgetDef(type, 2, { heading: "Termine", columns: 3, showOrganizer: true }),
            ]);

            const plan = planMigration(
                baseSnapshot({
                    pages: [
                        {
                            path: "",
                            title: "Home",
                            config: {
                                type: "page",
                                // Municipality customized heading, never touched columns.
                                children: [{ id: "n1", type, props: { heading: "Musterstadt", columns: 3 } }],
                            },
                        },
                    ],
                    dependencies: [{ type, version: 1, contracts: [] }],
                })
            );

            const nodePlan = plan.pages[0]?.nodes[0];
            expect(nodePlan?.status).toBe("upgradable");
            expect(nodePlan?.fromVersion).toBe(1);
            expect(nodePlan?.toVersion).toBe(2);
            expect(nodePlan?.mergedProps).toEqual({ heading: "Musterstadt", columns: 3, showOrganizer: true });
            expect(nodePlan?.addedFields).toEqual(["showOrganizer"]);
            expect(nodePlan?.conflicts).toEqual([]);
            expect(plan.requiresReview).toBe(false);
        });

        it("produces a needs-review plan when the merge finds a genuine conflict", () => {
            const type = "migratableWidgetConflict";
            registerComponentDefinitions([widgetDef(type, 1, { columns: 3 }), widgetDef(type, 2, { columns: 4 })]);

            const plan = planMigration(
                baseSnapshot({
                    pages: [
                        {
                            path: "",
                            title: "Home",
                            config: { type: "page", children: [{ id: "n1", type, props: { columns: 2 } }] },
                        },
                    ],
                    dependencies: [{ type, version: 1, contracts: [] }],
                })
            );

            const nodePlan = plan.pages[0]?.nodes[0];
            expect(nodePlan?.status).toBe("needs-review");
            expect(nodePlan?.conflicts).toEqual([{ key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 }]);
            expect(plan.requiresReview).toBe(true);
        });

        it("marks a node unresolvable when the version it was built against is no longer registered", () => {
            const type = "migratableWidgetOldGone";
            // Only v2 is registered — v1 (what the release recorded) was
            // deleted/archived, so BASE can't be computed at all.
            registerComponentDefinitions([widgetDef(type, 2, { columns: 4 })]);

            const plan = planMigration(
                baseSnapshot({
                    pages: [
                        {
                            path: "",
                            title: "Home",
                            config: { type: "page", children: [{ id: "n1", type, props: { columns: 2 } }] },
                        },
                    ],
                    dependencies: [{ type, version: 1, contracts: [] }],
                })
            );

            const nodePlan = plan.pages[0]?.nodes[0];
            expect(nodePlan?.status).toBe("unresolvable");
            expect(plan.requiresReview).toBe(true);
        });

        it("marks a node unresolvable when the type itself is no longer registered at all", () => {
            const type = "migratableWidgetNeverRegistered";
            // This type is never registered at all, simulating full removal.
            const plan = planMigration(
                baseSnapshot({
                    pages: [
                        {
                            path: "",
                            title: "Home",
                            config: { type: "page", children: [{ id: "n1", type, props: {} }] },
                        },
                    ],
                    dependencies: [{ type, version: 1, contracts: [] }],
                })
            );

            const nodePlan = plan.pages[0]?.nodes[0];
            expect(nodePlan?.status).toBe("unresolvable");
        });

        it("plans multiple nodes across multiple pages independently", () => {
            const type = "migratableWidgetMultiPage";
            registerComponentDefinitions([widgetDef(type, 1, { columns: 3 }), widgetDef(type, 2, { columns: 3 })]);

            const plan = planMigration(
                baseSnapshot({
                    pages: [
                        {
                            path: "",
                            title: "Home",
                            config: { type: "page", children: [{ id: "n1", type, props: { columns: 3 } }] },
                        },
                        {
                            path: "about",
                            title: "About",
                            config: { type: "page", children: [{ id: "n2", type, props: { columns: 3 } }] },
                        },
                    ],
                    dependencies: [{ type, version: 1, contracts: [] }],
                })
            );

            expect(plan.pages).toHaveLength(2);
            expect(plan.pages[0]?.nodes[0]?.nodeId).toBe("n1");
            expect(plan.pages[1]?.nodes[0]?.nodeId).toBe("n2");
        });
    });
});
