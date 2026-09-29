import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrationRepository } from "./migration-repository";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        migration: {
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/logger/logger", () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe("migrationRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("recordProposed", () => {
        it("creates a PROPOSED migration row with the given plan snapshot", async () => {
            const migration = { id: "migration-1", websiteId: "website-1", status: "PROPOSED" };
            vi.mocked(prisma.migration.create).mockResolvedValue(migration as never);

            const result = await migrationRepository.recordProposed("website-1", "release-1", { pages: [] });

            expect(result).toEqual({ ok: true, data: migration });
            expect(prisma.migration.create).toHaveBeenCalledWith({
                data: {
                    websiteId: "website-1",
                    sourceReleaseId: "release-1",
                    status: "PROPOSED",
                    planSnapshot: { pages: [] },
                    resolutions: {},
                },
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");
            vi.mocked(prisma.migration.create).mockRejectedValue(cause);

            const result = await migrationRepository.recordProposed("website-1", "release-1", {});

            expect(result.ok).toBe(false);
            expect(logger.error).toHaveBeenCalledWith("migrationRepository.recordProposed failed", {
                cause,
                websiteId: "website-1",
            });
        });
    });

    describe("markApplied", () => {
        it("updates the migration to APPLIED with the given resolutions and a timestamp", async () => {
            const migration = { id: "migration-1", status: "APPLIED" };
            vi.mocked(prisma.migration.update).mockResolvedValue(migration as never);

            const result = await migrationRepository.markApplied("migration-1", { n1: { columns: "keep-local" } });

            expect(result).toEqual({ ok: true, data: migration });
            expect(prisma.migration.update).toHaveBeenCalledWith({
                where: { id: "migration-1" },
                data: {
                    status: "APPLIED",
                    resolutions: { n1: { columns: "keep-local" } },
                    appliedAt: expect.any(Date),
                },
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Not found");
            vi.mocked(prisma.migration.update).mockRejectedValue(cause);

            const result = await migrationRepository.markApplied("migration-1", {});

            expect(result.ok).toBe(false);
        });
    });

    describe("findHistoryByWebsiteId", () => {
        it("returns migrations ordered newest-first", async () => {
            const migrations = [{ id: "m2" }, { id: "m1" }];
            vi.mocked(prisma.migration.findMany).mockResolvedValue(migrations as never);

            const result = await migrationRepository.findHistoryByWebsiteId("website-1");

            expect(result).toEqual({ ok: true, data: migrations });
            expect(prisma.migration.findMany).toHaveBeenCalledWith({
                where: { websiteId: "website-1" },
                orderBy: { createdAt: "desc" },
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");
            vi.mocked(prisma.migration.findMany).mockRejectedValue(cause);

            const result = await migrationRepository.findHistoryByWebsiteId("website-1");

            expect(result.ok).toBe(false);
        });
    });
});
