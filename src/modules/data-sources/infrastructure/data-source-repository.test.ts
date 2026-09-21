import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataSourceRepository } from "./data-source-repository";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError, isNotFoundError } from "@/lib/db/prisma-errors";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        dataSource: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

vi.mock("@/lib/logger/logger", () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock("@/lib/db/prisma-errors", () => ({
    isUniqueConstraintError: vi.fn(),
    isNotFoundError: vi.fn(),
}));

describe("dataSourceRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isUniqueConstraintError).mockReturnValue(false);
        vi.mocked(isNotFoundError).mockReturnValue(false);
    });

    describe("findByWebsite", () => {
        it("returns all data sources for a website, oldest first", async () => {
            const rows = [{ id: "ds-1", websiteId: "website-1", dataset: "civic" }];
            vi.mocked(prisma.dataSource.findMany).mockResolvedValue(rows as never);

            const result = await dataSourceRepository.findByWebsite("website-1");

            expect(result).toEqual({ ok: true, data: rows });
            expect(prisma.dataSource.findMany).toHaveBeenCalledWith({
                where: { websiteId: "website-1" },
                orderBy: { createdAt: "asc" },
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database unavailable");
            vi.mocked(prisma.dataSource.findMany).mockRejectedValue(cause);

            const result = await dataSourceRepository.findByWebsite("website-1");

            expect(result.ok).toBe(false);
            expect(logger.error).toHaveBeenCalledWith("dataSourceRepository.findByWebsite failed", {
                cause,
                websiteId: "website-1",
            });
        });
    });

    describe("findByWebsiteAndDataset", () => {
        it("returns the configured row for the dataset", async () => {
            const row = { id: "ds-1", websiteId: "website-1", dataset: "civic", kind: "REST" };
            vi.mocked(prisma.dataSource.findUnique).mockResolvedValue(row as never);

            const result = await dataSourceRepository.findByWebsiteAndDataset("website-1", "civic");

            expect(result).toEqual({ ok: true, data: row });
            expect(prisma.dataSource.findUnique).toHaveBeenCalledWith({
                where: { websiteId_dataset: { websiteId: "website-1", dataset: "civic" } },
            });
        });

        it("returns null when no source is configured for the dataset", async () => {
            vi.mocked(prisma.dataSource.findUnique).mockResolvedValue(null);

            const result = await dataSourceRepository.findByWebsiteAndDataset("website-1", "smartcity");

            expect(result).toEqual({ ok: true, data: null });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");
            vi.mocked(prisma.dataSource.findUnique).mockRejectedValue(cause);

            const result = await dataSourceRepository.findByWebsiteAndDataset("website-1", "civic");

            expect(result.ok).toBe(false);
        });
    });

    describe("upsert", () => {
        const input = {
            websiteId: "website-1",
            dataset: "civic" as const,
            name: "Municipal Events",
            kind: "REST" as const,
            config: { baseUrl: "https://example.de/api" },
        };

        it("creates or updates the one source for (website, dataset) and resets diagnostics/mapping", async () => {
            const row = { id: "ds-1", ...input };
            vi.mocked(prisma.dataSource.upsert).mockResolvedValue(row as never);

            const result = await dataSourceRepository.upsert(input);

            expect(result).toEqual({ ok: true, data: row });
            expect(prisma.dataSource.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { websiteId_dataset: { websiteId: "website-1", dataset: "civic" } },
                    create: expect.objectContaining({
                        websiteId: "website-1",
                        dataset: "civic",
                        name: "Municipal Events",
                        kind: "REST",
                        config: input.config,
                    }),
                    update: expect.objectContaining({
                        name: "Municipal Events",
                        kind: "REST",
                        config: input.config,
                        mapping: null,
                        status: "UNKNOWN",
                        lastCheckedAt: null,
                        lastError: null,
                    }),
                })
            );
        });

        it("maps a unique constraint error to a conflict error", async () => {
            const cause = new Error("Unique constraint failed");
            vi.mocked(prisma.dataSource.upsert).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(true);

            const result = await dataSourceRepository.upsert(input);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("CONFLICT");
        });

        it("maps a not-found error to a website-not-found error", async () => {
            const cause = new Error("Record not found");
            vi.mocked(prisma.dataSource.upsert).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(true);

            const result = await dataSourceRepository.upsert(input);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
        });
    });

    describe("recordTestResult", () => {
        it("records a successful test result with a timestamp", async () => {
            const row = { id: "ds-1", status: "OK", lastError: null };
            vi.mocked(prisma.dataSource.update).mockResolvedValue(row as never);

            const result = await dataSourceRepository.recordTestResult("ds-1", { status: "OK", lastError: null });

            expect(result).toEqual({ ok: true, data: row });
            expect(prisma.dataSource.update).toHaveBeenCalledWith({
                where: { id: "ds-1" },
                data: { status: "OK", lastError: null, lastCheckedAt: expect.any(Date) },
            });
        });

        it("records a failed test result with a diagnostic message", async () => {
            const row = { id: "ds-1", status: "ERROR", lastError: "Unauthorized" };
            vi.mocked(prisma.dataSource.update).mockResolvedValue(row as never);

            const result = await dataSourceRepository.recordTestResult("ds-1", {
                status: "ERROR",
                lastError: "Unauthorized",
            });

            expect(result).toEqual({ ok: true, data: row });
        });

        it("returns not-found when the data source no longer exists", async () => {
            const cause = new Error("Record not found");
            vi.mocked(prisma.dataSource.update).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(true);

            const result = await dataSourceRepository.recordTestResult("missing", { status: "OK", lastError: null });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
        });
    });

    describe("saveMapping", () => {
        it("persists the mapping JSON for a data source", async () => {
            const mapping = { fields: [{ sourcePath: "a", targetPath: "b" }] };
            const row = { id: "ds-1", mapping };
            vi.mocked(prisma.dataSource.update).mockResolvedValue(row as never);

            const result = await dataSourceRepository.saveMapping("ds-1", mapping);

            expect(result).toEqual({ ok: true, data: row });
            expect(prisma.dataSource.update).toHaveBeenCalledWith({
                where: { id: "ds-1" },
                data: { mapping },
            });
        });
    });

    describe("delete", () => {
        it("deletes a data source", async () => {
            vi.mocked(prisma.dataSource.delete).mockResolvedValue({} as never);

            const result = await dataSourceRepository.delete("ds-1");

            expect(result).toEqual({ ok: true, data: undefined });
            expect(prisma.dataSource.delete).toHaveBeenCalledWith({ where: { id: "ds-1" } });
        });

        it("returns not-found when deleting a missing data source", async () => {
            const cause = new Error("Record not found");
            vi.mocked(prisma.dataSource.delete).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(true);

            const result = await dataSourceRepository.delete("missing");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
        });
    });
});
