import { beforeEach, describe, expect, it, vi } from "vitest";
import { releaseRepository } from "./release-repository";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        website: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        websiteRelease: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/logger/logger", () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe("releaseRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("findPublishedByWebsiteId", () => {
        it("returns the published release when one exists", async () => {
            const release = { id: "release-1", websiteId: "website-1", releaseNumber: 3 };
            vi.mocked(prisma.website.findUnique).mockResolvedValue({
                id: "website-1",
                publishedRelease: release,
            } as never);

            const result = await releaseRepository.findPublishedByWebsiteId("website-1");

            expect(result).toEqual({ ok: true, data: release });
            expect(prisma.website.findUnique).toHaveBeenCalledWith({
                where: { id: "website-1" },
                include: { publishedRelease: true },
            });
        });

        it("returns null when the website has never been published", async () => {
            vi.mocked(prisma.website.findUnique).mockResolvedValue({
                id: "website-1",
                publishedRelease: null,
            } as never);

            const result = await releaseRepository.findPublishedByWebsiteId("website-1");

            expect(result).toEqual({ ok: true, data: null });
        });

        it("returns null when the website itself does not exist", async () => {
            vi.mocked(prisma.website.findUnique).mockResolvedValue(null);

            const result = await releaseRepository.findPublishedByWebsiteId("missing");

            expect(result).toEqual({ ok: true, data: null });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");
            vi.mocked(prisma.website.findUnique).mockRejectedValue(cause);

            const result = await releaseRepository.findPublishedByWebsiteId("website-1");

            expect(result.ok).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                "releaseRepository.findPublishedByWebsiteId failed",
                { cause, websiteId: "website-1" }
            );
        });
    });

    describe("findHistoryByWebsiteId", () => {
        it("returns releases ordered newest-first", async () => {
            const releases = [
                { id: "release-2", releaseNumber: 2 },
                { id: "release-1", releaseNumber: 1 },
            ];
            vi.mocked(prisma.websiteRelease.findMany).mockResolvedValue(releases as never);

            const result = await releaseRepository.findHistoryByWebsiteId("website-1");

            expect(result).toEqual({ ok: true, data: releases });
            expect(prisma.websiteRelease.findMany).toHaveBeenCalledWith({
                where: { websiteId: "website-1" },
                orderBy: { releaseNumber: "desc" },
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database error");
            vi.mocked(prisma.websiteRelease.findMany).mockRejectedValue(cause);

            const result = await releaseRepository.findHistoryByWebsiteId("website-1");

            expect(result.ok).toBe(false);
        });
    });

    describe("publish", () => {
        const snapshot = { schemaVersion: 1, pages: [] };
        const snapshotHash = "hash-abc";

        function mockTransaction(tx: {
            findFirst: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        }) {
            vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
                return (callback as (tx: unknown) => unknown)({
                    websiteRelease: { findFirst: tx.findFirst, create: tx.create },
                    website: { update: tx.update },
                });
            });
        }

        it("creates release number 1 when no prior release exists, and points the website at it", async () => {
            const findFirst = vi.fn().mockResolvedValue(null);
            const created = {
                id: "release-1",
                websiteId: "website-1",
                releaseNumber: 1,
                status: "PUBLISHED",
                snapshot,
                snapshotHash,
            };
            const create = vi.fn().mockResolvedValue(created);
            const update = vi.fn().mockResolvedValue({});
            mockTransaction({ findFirst, create, update });

            const result = await releaseRepository.publish("website-1", snapshot, snapshotHash);

            expect(result).toEqual({ ok: true, data: created });
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    websiteId: "website-1",
                    releaseNumber: 1,
                    status: "PUBLISHED",
                    snapshot,
                    snapshotHash,
                }),
            });
            expect(update).toHaveBeenCalledWith({
                where: { id: "website-1" },
                data: { publishedReleaseId: "release-1" },
            });
        });

        it("increments the release number from the latest existing release", async () => {
            const findFirst = vi.fn().mockResolvedValue({ releaseNumber: 4 });
            const created = { id: "release-5", websiteId: "website-1", releaseNumber: 5 };
            const create = vi.fn().mockResolvedValue(created);
            const update = vi.fn().mockResolvedValue({});
            mockTransaction({ findFirst, create, update });

            const result = await releaseRepository.publish("website-1", snapshot, snapshotHash);

            expect(result).toEqual({ ok: true, data: created });
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({ releaseNumber: 5 }),
            });
        });

        it("returns a database error when the transaction fails, without partial mutation", async () => {
            const cause = new Error("Unique constraint failed");
            vi.mocked(prisma.$transaction).mockRejectedValue(cause);

            const result = await releaseRepository.publish("website-1", snapshot, snapshotHash);

            expect(result.ok).toBe(false);
            expect(logger.error).toHaveBeenCalledWith("releaseRepository.publish failed", {
                cause,
                websiteId: "website-1",
            });
        });
    });

    describe("findAllPublished", () => {
        it("returns the published release of every website that has one", async () => {
            const releaseA = { id: "release-a", websiteId: "website-a" };
            const releaseB = { id: "release-b", websiteId: "website-b" };
            vi.mocked(prisma.website.findMany).mockResolvedValue([
                { id: "website-a", publishedRelease: releaseA },
                { id: "website-b", publishedRelease: releaseB },
            ] as never);

            const result = await releaseRepository.findAllPublished();

            expect(result).toEqual({ ok: true, data: [releaseA, releaseB] });
            expect(prisma.website.findMany).toHaveBeenCalledWith({
                where: { publishedReleaseId: { not: null } },
                include: { publishedRelease: true },
            });
        });

        it("returns an empty array when no website has ever published", async () => {
            vi.mocked(prisma.website.findMany).mockResolvedValue([]);

            const result = await releaseRepository.findAllPublished();

            expect(result).toEqual({ ok: true, data: [] });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");
            vi.mocked(prisma.website.findMany).mockRejectedValue(cause);

            const result = await releaseRepository.findAllPublished();

            expect(result.ok).toBe(false);
            expect(logger.error).toHaveBeenCalledWith("releaseRepository.findAllPublished failed", { cause });
        });
    });
});
