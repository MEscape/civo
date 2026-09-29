import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { releaseService } from "./release-service";
import { releaseRepository } from "@/modules/release/infrastructure/release-repository";
import { websiteRepository } from "@/modules/website/infrastructure/website-repository";
import { pageRepository } from "@/modules/builder/infrastructure/page-repository";
import { registerComponentDefinitions, clearComponentRegistry } from "@/modules/component-platform/domain";
import { componentDefinitions } from "@/modules/component-platform/infrastructure/definitions";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";

vi.mock("@/modules/release/infrastructure/release-repository", () => ({
    releaseRepository: {
        publish: vi.fn(),
        findPublishedByWebsiteId: vi.fn(),
        findAllPublished: vi.fn(),
        findHistoryByWebsiteId: vi.fn(),
        rollback: vi.fn(),
    },
}));

vi.mock("@/modules/website/infrastructure/website-repository", () => ({
    websiteRepository: {
        findById: vi.fn(),
    },
}));

vi.mock("@/modules/builder/infrastructure/page-repository", () => ({
    pageRepository: {
        findByWebsiteId: vi.fn(),
    },
}));

const website = {
    id: "website-1",
    name: "Stadt Musterstadt",
    slug: "musterstadt",
    description: null,
    templateKey: "municipal",
    themeId: "theme-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    theme: {
        id: "theme-1",
        primaryColor: "#024B6D",
        secondaryColor: "#577A8C",
        accentColor: "#D14900",
        headingFont: "Inter",
        bodyFont: "Inter",
        radius: "md",
        spacingScale: "comfortable",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
};

const validPageConfig = { type: "page" as const, children: [] };

describe("releaseService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("publish", () => {
        it("assembles a snapshot from current pages and publishes it", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                ok([
                    {
                        id: "page-1",
                        websiteId: "website-1",
                        path: "",
                        title: "Startseite",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        configs: [{ id: "config-1", version: 2, content: validPageConfig } as never],
                    },
                ])
            );
            const publishedRelease = { id: "release-1", websiteId: "website-1", releaseNumber: 1 };
            vi.mocked(releaseRepository.publish).mockResolvedValue(ok(publishedRelease as never));

            const result = await releaseService.publish("website-1");

            expect(result).toEqual({ ok: true, data: publishedRelease });
            expect(releaseRepository.publish).toHaveBeenCalledWith(
                "website-1",
                expect.objectContaining({
                    schemaVersion: 1,
                    website: expect.objectContaining({ id: "website-1", slug: "musterstadt" }),
                    pages: [{ path: "", title: "Startseite", config: validPageConfig }],
                    dependencies: [],
                }),
                expect.any(String)
            );
        });

        it("returns NOT_FOUND when the website does not exist", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue(ok(null));

            const result = await releaseService.publish("missing");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
            expect(releaseRepository.publish).not.toHaveBeenCalled();
        });

        it("returns a validation error when the website has no pages", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(ok([]));

            const result = await releaseService.publish("website-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
            expect(releaseRepository.publish).not.toHaveBeenCalled();
        });

        it("returns a validation error when a page's stored config is invalid, without publishing", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                ok([
                    {
                        id: "page-1",
                        websiteId: "website-1",
                        path: "",
                        title: "Startseite",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        configs: [{ id: "config-1", version: 1, content: { not: "valid" } } as never],
                    },
                ])
            );

            const result = await releaseService.publish("website-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
            expect(releaseRepository.publish).not.toHaveBeenCalled();
        });

        it("propagates a repository error from findById", async () => {
            const failure = err(AppErrors.database());
            vi.mocked(websiteRepository.findById).mockResolvedValue(failure);

            const result = await releaseService.publish("website-1");

            expect(result).toBe(failure);
        });

        it("produces the same snapshotHash for the same logical content", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                ok([
                    {
                        id: "page-1",
                        websiteId: "website-1",
                        path: "",
                        title: "Startseite",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        configs: [{ id: "config-1", version: 1, content: validPageConfig } as never],
                    },
                ])
            );
            vi.mocked(releaseRepository.publish).mockResolvedValue(
                ok({ id: "release-1" } as never)
            );

            await releaseService.publish("website-1");
            await releaseService.publish("website-1");

            const firstHash = vi.mocked(releaseRepository.publish).mock.calls[0]?.[2];
            const secondHash = vi.mocked(releaseRepository.publish).mock.calls[1]?.[2];
            expect(firstHash).toBe(secondHash);
        });

        describe("contract compatibility gate", () => {
            afterEach(() => {
                // clearComponentRegistry() wipes ALL registered types, not
                // just the fabricated ones these tests add — restore the
                // real registry vitest.setup.ts originally populated so
                // any test running later in this file (or in a shared
                // watch-mode session) doesn't see an empty registry.
                clearComponentRegistry();
                registerComponentDefinitions(componentDefinitions);
            });

            it("blocks publishing a page containing a component whose contract dependency is unmet", async () => {
                registerComponentDefinitions([
                    {
                        type: "futureEventsGrid",
                        label: "Future Events Grid",
                        category: "civic",
                        description: "Fabricated for this test.",
                        canHaveChildren: false,
                        createDefaultNode: () => ({ id: "n1", type: "futureEventsGrid", props: {} }),
                        propsSchema: z.object({}),
                        fields: [],
                        dependsOnContracts: [{ contract: "CivicEvent", minVersion: 99 }],
                    },
                ]);
                vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
                vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                    ok([
                        {
                            id: "page-1",
                            websiteId: "website-1",
                            path: "",
                            title: "Startseite",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            configs: [
                                {
                                    id: "config-1",
                                    version: 1,
                                    content: {
                                        type: "page",
                                        children: [{ id: "n1", type: "futureEventsGrid", props: {} }],
                                    },
                                } as never,
                            ],
                        },
                    ])
                );

                const result = await releaseService.publish("website-1");

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe("VALIDATION_ERROR");
                    expect(result.error.message).toContain("futureEventsGrid");
                    expect(result.error.message).toContain("CivicEvent@99");
                }
                expect(releaseRepository.publish).not.toHaveBeenCalled();
            });

            it("publishes normally when a component's contract dependency is satisfied", async () => {
                registerComponentDefinitions([
                    {
                        type: "compatibleEventsGrid",
                        label: "Compatible Events Grid",
                        category: "civic",
                        description: "Fabricated for this test.",
                        canHaveChildren: false,
                        createDefaultNode: () => ({ id: "n1", type: "compatibleEventsGrid", props: {} }),
                        propsSchema: z.object({}),
                        fields: [],
                        dependsOnContracts: [{ contract: "CivicEvent", minVersion: 1 }],
                    },
                ]);
                vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
                vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                    ok([
                        {
                            id: "page-1",
                            websiteId: "website-1",
                            path: "",
                            title: "Startseite",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            configs: [
                                {
                                    id: "config-1",
                                    version: 1,
                                    content: {
                                        type: "page",
                                        children: [{ id: "n1", type: "compatibleEventsGrid", props: {} }],
                                    },
                                } as never,
                            ],
                        },
                    ])
                );
                vi.mocked(releaseRepository.publish).mockResolvedValue(ok({ id: "release-1" } as never));

                const result = await releaseService.publish("website-1");

                expect(result.ok).toBe(true);
                expect(releaseRepository.publish).toHaveBeenCalled();
            });

            it("does not block publishing on a node whose type is not registered at all", async () => {
                vi.mocked(websiteRepository.findById).mockResolvedValue(ok(website as never));
                vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(
                    ok([
                        {
                            id: "page-1",
                            websiteId: "website-1",
                            path: "",
                            title: "Startseite",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            configs: [
                                {
                                    id: "config-1",
                                    version: 1,
                                    content: {
                                        type: "page",
                                        children: [{ id: "n1", type: "totallyUnregisteredType", props: {} }],
                                    },
                                } as never,
                            ],
                        },
                    ])
                );
                vi.mocked(releaseRepository.publish).mockResolvedValue(ok({ id: "release-1" } as never));

                const result = await releaseService.publish("website-1");

                // Unknown types are render-nodes.tsx's concern (placeholder
                // at render time), not a publish-blocking contract issue.
                expect(result.ok).toBe(true);
            });
        });
    });

    describe("getPublishedSnapshot", () => {
        it("returns the validated snapshot of the published release", async () => {
            const snapshot = {
                schemaVersion: 1,
                website: { id: "website-1", name: "Stadt Musterstadt", slug: "musterstadt", description: null },
                theme: {
                    primaryColor: "#024B6D",
                    secondaryColor: "#577A8C",
                    accentColor: "#D14900",
                    headingFont: "Inter",
                    bodyFont: "Inter",
                    radius: "md",
                    spacingScale: "comfortable",
                },
                pages: [{ path: "", title: "Startseite", config: validPageConfig }],
                dependencies: [],
            };
            vi.mocked(releaseRepository.findPublishedByWebsiteId).mockResolvedValue(
                ok({ id: "release-1", snapshot } as never)
            );

            const result = await releaseService.getPublishedSnapshot("website-1");

            expect(result).toEqual({ ok: true, data: snapshot });
        });

        it("returns NOT_FOUND when the website has never been published", async () => {
            vi.mocked(releaseRepository.findPublishedByWebsiteId).mockResolvedValue(ok(null));

            const result = await releaseService.getPublishedSnapshot("website-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
        });

        it("fails closed when the stored snapshot no longer matches the schema", async () => {
            vi.mocked(releaseRepository.findPublishedByWebsiteId).mockResolvedValue(
                ok({ id: "release-1", snapshot: { not: "valid" } } as never)
            );

            const result = await releaseService.getPublishedSnapshot("website-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
        });
    });

    describe("findWebsitesUsingComponent", () => {
        function snapshotWithDependency(websiteId: string, dependencies: { type: string; version: number; contracts: never[] }[]) {
            return {
                schemaVersion: 1,
                website: { id: websiteId, name: "Site", slug: websiteId, description: null },
                theme: {
                    primaryColor: "#024B6D",
                    secondaryColor: "#577A8C",
                    accentColor: "#D14900",
                    headingFont: "Inter",
                    bodyFont: "Inter",
                    radius: "md",
                    spacingScale: "comfortable",
                },
                pages: [{ path: "", title: "Home", config: validPageConfig }],
                dependencies,
            };
        }

        it("returns every published website that depends on the given component type", async () => {
            vi.mocked(releaseRepository.findAllPublished).mockResolvedValue(
                ok([
                    {
                        id: "release-a",
                        websiteId: "website-a",
                        snapshot: snapshotWithDependency("website-a", [
                            { type: "eventsGrid", version: 2, contracts: [] },
                        ]),
                    },
                    {
                        id: "release-b",
                        websiteId: "website-b",
                        snapshot: snapshotWithDependency("website-b", [{ type: "hero", version: 1, contracts: [] }]),
                    },
                ] as never)
            );

            const result = await releaseService.findWebsitesUsingComponent("eventsGrid");

            expect(result).toEqual({
                ok: true,
                data: [{ websiteId: "website-a", releaseId: "release-a", componentVersion: 2 }],
            });
        });

        it("narrows to a specific version when one is given", async () => {
            vi.mocked(releaseRepository.findAllPublished).mockResolvedValue(
                ok([
                    {
                        id: "release-a",
                        websiteId: "website-a",
                        snapshot: snapshotWithDependency("website-a", [
                            { type: "eventsGrid", version: 2, contracts: [] },
                        ]),
                    },
                    {
                        id: "release-b",
                        websiteId: "website-b",
                        snapshot: snapshotWithDependency("website-b", [
                            { type: "eventsGrid", version: 3, contracts: [] },
                        ]),
                    },
                ] as never)
            );

            const result = await releaseService.findWebsitesUsingComponent("eventsGrid", 2);

            expect(result).toEqual({
                ok: true,
                data: [{ websiteId: "website-a", releaseId: "release-a", componentVersion: 2 }],
            });
        });

        it("returns an empty list when no published website uses the component", async () => {
            vi.mocked(releaseRepository.findAllPublished).mockResolvedValue(
                ok([
                    {
                        id: "release-a",
                        websiteId: "website-a",
                        snapshot: snapshotWithDependency("website-a", [{ type: "hero", version: 1, contracts: [] }]),
                    },
                ] as never)
            );

            const result = await releaseService.findWebsitesUsingComponent("eventsGrid");

            expect(result).toEqual({ ok: true, data: [] });
        });

        it("skips a release whose stored snapshot no longer validates, rather than failing the whole query", async () => {
            vi.mocked(releaseRepository.findAllPublished).mockResolvedValue(
                ok([
                    { id: "release-corrupt", websiteId: "website-a", snapshot: { not: "valid" } },
                    {
                        id: "release-b",
                        websiteId: "website-b",
                        snapshot: snapshotWithDependency("website-b", [
                            { type: "eventsGrid", version: 1, contracts: [] },
                        ]),
                    },
                ] as never)
            );

            const result = await releaseService.findWebsitesUsingComponent("eventsGrid");

            expect(result).toEqual({
                ok: true,
                data: [{ websiteId: "website-b", releaseId: "release-b", componentVersion: 1 }],
            });
        });

        it("propagates a repository error", async () => {
            const failure = err(AppErrors.database());
            vi.mocked(releaseRepository.findAllPublished).mockResolvedValue(failure);

            const result = await releaseService.findWebsitesUsingComponent("eventsGrid");

            expect(result).toBe(failure);
        });
    });
});
