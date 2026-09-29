import { describe, expect, it, vi, beforeEach } from "vitest";
import { migrationService } from "@/modules/migration/application/migration-service";
import { releaseService } from "@/modules/release/application/release-service";
import { releaseRepository } from "@/modules/release/infrastructure/release-repository";
import { pageRepository } from "@/modules/builder/infrastructure/page-repository";
import { migrationRepository } from "@/modules/migration/infrastructure/migration-repository";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import type { ReleaseSnapshot } from "@/modules/release/domain/release-snapshot";
import type { MigrationPlan } from "@/modules/migration/domain/migration-plan";

vi.mock("@/modules/release/application/release-service", () => ({
    releaseService: { getPublishedSnapshot: vi.fn() },
}));
vi.mock("@/modules/release/infrastructure/release-repository", () => ({
    releaseRepository: { findPublishedByWebsiteId: vi.fn() },
}));
vi.mock("@/modules/builder/infrastructure/page-repository", () => ({
    pageRepository: { findByWebsiteAndPath: vi.fn(), saveConfig: vi.fn() },
}));
vi.mock("@/modules/migration/infrastructure/migration-repository", () => ({
    migrationRepository: {
        recordProposed: vi.fn(),
        markApplied: vi.fn(),
        findHistoryByWebsiteId: vi.fn(),
    },
}));

const snapshot: ReleaseSnapshot = {
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
    pages: [{ path: "", title: "Home", config: { type: "page", children: [{ id: "n1", type: "hero", props: {} }] } }],
    dependencies: [{ type: "hero", version: 1, contracts: [] }],
};

describe("migrationService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("proposeMigration", () => {
        it("plans and records a proposal for the currently published release", async () => {
            vi.mocked(releaseRepository.findPublishedByWebsiteId).mockResolvedValue(
                ok({ id: "release-1", websiteId: "website-1" } as never)
            );
            vi.mocked(releaseService.getPublishedSnapshot).mockResolvedValue(ok(snapshot));
            vi.mocked(migrationRepository.recordProposed).mockResolvedValue(
                ok({ id: "migration-1" } as never)
            );

            const result = await migrationService.proposeMigration("website-1");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data.migrationId).toBe("migration-1");
                expect(result.data.plan.pages[0]?.nodes[0]).toEqual(
                    expect.objectContaining({ nodeId: "n1", status: "unchanged" })
                );
            }
            expect(migrationRepository.recordProposed).toHaveBeenCalledWith(
                "website-1",
                "release-1",
                expect.anything()
            );
        });

        it("returns NOT_FOUND when the website has never published", async () => {
            vi.mocked(releaseRepository.findPublishedByWebsiteId).mockResolvedValue(ok(null));

            const result = await migrationService.proposeMigration("website-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
            expect(migrationRepository.recordProposed).not.toHaveBeenCalled();
        });
    });

    describe("applyMigration", () => {
        const upgradablePlan: MigrationPlan = {
            pages: [
                {
                    path: "",
                    nodes: [
                        {
                            nodeId: "n1",
                            type: "hero",
                            fromVersion: 1,
                            toVersion: 2,
                            status: "upgradable",
                            mergedProps: { heading: "New default" },
                            conflicts: [],
                            addedFields: [],
                        },
                    ],
                },
            ],
            requiresReview: false,
            isUpToDate: false,
        };

        it("writes a new draft only for pages with an actual change, then marks the migration applied", async () => {
            vi.mocked(releaseService.getPublishedSnapshot).mockResolvedValue(ok(snapshot));
            vi.mocked(pageRepository.findByWebsiteAndPath).mockResolvedValue(
                ok({ id: "page-1" } as never)
            );
            vi.mocked(pageRepository.saveConfig).mockResolvedValue(ok({ id: "config-2" } as never));
            vi.mocked(migrationRepository.markApplied).mockResolvedValue(ok({ id: "migration-1" } as never));

            const result = await migrationService.applyMigration("website-1", upgradablePlan, "migration-1", {});

            expect(result).toEqual({ ok: true, data: { updatedPaths: [""] } });
            expect(pageRepository.findByWebsiteAndPath).toHaveBeenCalledWith("website-1", "");
            expect(pageRepository.saveConfig).toHaveBeenCalledWith("page-1", expect.anything());
            expect(migrationRepository.markApplied).toHaveBeenCalledWith("migration-1", {});
        });

        it("writes nothing when the plan has no upgradable/resolved nodes", async () => {
            const unchangedPlan: MigrationPlan = {
                pages: [
                    {
                        path: "",
                        nodes: [
                            {
                                nodeId: "n1",
                                type: "hero",
                                fromVersion: 1,
                                toVersion: 1,
                                status: "unchanged",
                                conflicts: [],
                                addedFields: [],
                            },
                        ],
                    },
                ],
                requiresReview: false,
                isUpToDate: true,
            };
            vi.mocked(releaseService.getPublishedSnapshot).mockResolvedValue(ok(snapshot));
            vi.mocked(migrationRepository.markApplied).mockResolvedValue(ok({ id: "migration-1" } as never));

            const result = await migrationService.applyMigration("website-1", unchangedPlan, "migration-1", {});

            expect(result).toEqual({ ok: true, data: { updatedPaths: [] } });
            expect(pageRepository.saveConfig).not.toHaveBeenCalled();
        });

        it("returns NOT_FOUND if a page the plan references no longer exists", async () => {
            vi.mocked(releaseService.getPublishedSnapshot).mockResolvedValue(ok(snapshot));
            vi.mocked(pageRepository.findByWebsiteAndPath).mockResolvedValue(ok(null));

            const result = await migrationService.applyMigration("website-1", upgradablePlan, "migration-1", {});

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
            expect(migrationRepository.markApplied).not.toHaveBeenCalled();
        });

        it("propagates a save failure without marking the migration applied", async () => {
            vi.mocked(releaseService.getPublishedSnapshot).mockResolvedValue(ok(snapshot));
            vi.mocked(pageRepository.findByWebsiteAndPath).mockResolvedValue(ok({ id: "page-1" } as never));
            vi.mocked(pageRepository.saveConfig).mockResolvedValue(err(AppErrors.database()));

            const result = await migrationService.applyMigration("website-1", upgradablePlan, "migration-1", {});

            expect(result.ok).toBe(false);
            expect(migrationRepository.markApplied).not.toHaveBeenCalled();
        });
    });

    describe("getMigrationHistory", () => {
        it("delegates to migrationRepository", async () => {
            vi.mocked(migrationRepository.findHistoryByWebsiteId).mockResolvedValue(ok([{ id: "m1" } as never]));

            const result = await migrationService.getMigrationHistory("website-1");

            expect(result).toEqual({ ok: true, data: [{ id: "m1" }] });
        });
    });
});
