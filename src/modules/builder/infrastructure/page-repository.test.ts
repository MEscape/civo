import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageRepository } from "./page-repository";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        page: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        pageConfig: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/logger/logger", () => ({
    logger: {
        error: vi.fn(),
    },
}));

vi.mock("@/lib/db/prisma-errors", () => ({
    isUniqueConstraintError: vi.fn(),
}));

describe("pageRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("findByWebsiteId", () => {
        it("returns pages for a website", async () => {
            const pages = [
                {
                    id: "page-1",
                    websiteId: "website-1",
                    path: "/",
                    title: "Home",
                    configs: [
                        {
                            id: "config-1",
                            version: 2,
                            content: {},
                        },
                    ],
                },
            ];

            vi.mocked(prisma.page.findMany).mockResolvedValue(pages as never);

            const result = await pageRepository.findByWebsiteId("website-1");

            expect(result).toEqual({
                ok: true,
                data: pages,
            });

            expect(prisma.page.findMany).toHaveBeenCalledWith({
                where: {
                    websiteId: "website-1",
                },
                include: {
                    configs: {
                        orderBy: {
                            version: "desc",
                        },
                        take: 1,
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
        });

        it("returns an empty array when no pages exist", async () => {
            vi.mocked(prisma.page.findMany).mockResolvedValue([]);

            const result = await pageRepository.findByWebsiteId("website-1");

            expect(result).toEqual({
                ok: true,
                data: [],
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.page.findMany).mockRejectedValue(cause);

            const result = await pageRepository.findByWebsiteId("website-1");

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.findByWebsiteId failed",
                {
                    cause,
                    websiteId: "website-1",
                },
            );
        });
    });

    describe("findById", () => {
        it("returns the page when found", async () => {
            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/",
                title: "Home",
                configs: [],
            };

            vi.mocked(prisma.page.findUnique).mockResolvedValue(page as never);

            const result = await pageRepository.findById("page-1");

            expect(result).toEqual({
                ok: true,
                data: page,
            });

            expect(prisma.page.findUnique).toHaveBeenCalledWith({
                where: {
                    id: "page-1",
                },
                include: {
                    configs: {
                        orderBy: {
                            version: "desc",
                        },
                        take: 1,
                    },
                },
            });
        });

        it("returns null when the page does not exist", async () => {
            vi.mocked(prisma.page.findUnique).mockResolvedValue(null);

            const result = await pageRepository.findById("missing");

            expect(result).toEqual({
                ok: true,
                data: null,
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");

            vi.mocked(prisma.page.findUnique).mockRejectedValue(cause);

            const result = await pageRepository.findById("page-1");

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.findById failed",
                {
                    cause,
                    id: "page-1",
                },
            );
        });
    });

    describe("findByWebsiteAndPath", () => {
        it("finds a page using the website/path compound key", async () => {
            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/about",
                title: "About",
                configs: [],
            };

            vi.mocked(prisma.page.findUnique).mockResolvedValue(page as never);

            const result = await pageRepository.findByWebsiteAndPath(
                "website-1",
                "/about",
            );

            expect(result).toEqual({
                ok: true,
                data: page,
            });

            expect(prisma.page.findUnique).toHaveBeenCalledWith({
                where: {
                    websiteId_path: {
                        websiteId: "website-1",
                        path: "/about",
                    },
                },
                include: {
                    configs: {
                        orderBy: {
                            version: "desc",
                        },
                        take: 1,
                    },
                },
            });
        });

        it("returns null when no matching page exists", async () => {
            vi.mocked(prisma.page.findUnique).mockResolvedValue(null);

            const result = await pageRepository.findByWebsiteAndPath(
                "website-1",
                "/missing",
            );

            expect(result).toEqual({
                ok: true,
                data: null,
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database error");

            vi.mocked(prisma.page.findUnique).mockRejectedValue(cause);

            const result = await pageRepository.findByWebsiteAndPath(
                "website-1",
                "/about",
            );

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.findByWebsiteAndPath failed",
                {
                    cause,
                    websiteId: "website-1",
                    path: "/about",
                },
            );
        });
    });

    describe("create", () => {
        const input = {
            websiteId: "website-1",
            path: "/about",
            title: "About",
            content: {
                type: "page",
                children: [],
            },
        };

        it("creates a page with its initial config", async () => {
            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/about",
                title: "About",
                configs: [
                    {
                        id: "config-1",
                        version: 1,
                        content: input.content,
                    },
                ],
            };

            vi.mocked(prisma.page.create).mockResolvedValue(page as never);

            const result = await pageRepository.create(input);

            expect(result).toEqual({
                ok: true,
                data: page,
            });

            expect(prisma.page.create).toHaveBeenCalledWith({
                data: {
                    websiteId: "website-1",
                    path: "/about",
                    title: "About",
                    configs: {
                        create: {
                            content: input.content,
                        },
                    },
                },
                include: {
                    configs: true,
                },
            });
        });

        it("maps a unique constraint error to a conflict error", async () => {
            const cause = new Error("Unique constraint failed");

            vi.mocked(prisma.page.create).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(true);

            const result = await pageRepository.create(input);

            expect(result.ok).toBe(false);

            expect(isUniqueConstraintError).toHaveBeenCalledWith(cause);

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.create failed",
                {
                    cause,
                    input: {
                        ...input,
                        content: "omitted",
                    },
                },
            );
        });

        it("maps non-unique Prisma errors to database errors", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.page.create).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(false);

            const result = await pageRepository.create(input);

            expect(result.ok).toBe(false);

            expect(isUniqueConstraintError).toHaveBeenCalledWith(cause);
        });

        it("does not log the page content", async () => {
            const cause = new Error("Database error");

            vi.mocked(prisma.page.create).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(false);

            await pageRepository.create(input);

            const logCall = vi.mocked(logger.error).mock.calls[0];

            expect(logCall?.[1]).toEqual({
                cause,
                input: {
                    websiteId: "website-1",
                    path: "/about",
                    title: "About",
                    content: "omitted",
                },
            });
        });
    });

    describe("saveConfig", () => {
        const content = {
            type: "page",
            children: [],
        };

        it("creates version 1 when no previous config exists", async () => {
            vi.mocked(prisma.pageConfig.findFirst).mockResolvedValue(null);

            const config = {
                id: "config-1",
                pageId: "page-1",
                version: 1,
                status: "PUBLISHED",
                content,
            };

            vi.mocked(prisma.pageConfig.create).mockResolvedValue(
                config as never,
            );

            const result = await pageRepository.saveConfig(
                "page-1",
                content,
            );

            expect(result).toEqual({
                ok: true,
                data: config,
            });

            expect(prisma.pageConfig.findFirst).toHaveBeenCalledWith({
                where: {
                    pageId: "page-1",
                },
                orderBy: {
                    version: "desc",
                },
            });

            expect(prisma.pageConfig.create).toHaveBeenCalledWith({
                data: {
                    pageId: "page-1",
                    content,
                    version: 1,
                    status: "PUBLISHED",
                },
            });
        });

        it("increments the latest config version", async () => {
            vi.mocked(prisma.pageConfig.findFirst).mockResolvedValue({
                id: "config-old",
                pageId: "page-1",
                version: 4,
            } as never);

            const config = {
                id: "config-new",
                pageId: "page-1",
                version: 5,
                status: "PUBLISHED",
                content,
            };

            vi.mocked(prisma.pageConfig.create).mockResolvedValue(
                config as never,
            );

            const result = await pageRepository.saveConfig(
                "page-1",
                content,
            );

            expect(result).toEqual({
                ok: true,
                data: config,
            });

            expect(prisma.pageConfig.create).toHaveBeenCalledWith({
                data: {
                    pageId: "page-1",
                    content,
                    version: 5,
                    status: "PUBLISHED",
                },
            });
        });

        it("returns a database error when finding the latest config fails", async () => {
            const cause = new Error("Database error");

            vi.mocked(prisma.pageConfig.findFirst).mockRejectedValue(cause);

            const result = await pageRepository.saveConfig(
                "page-1",
                content,
            );

            expect(result.ok).toBe(false);

            expect(prisma.pageConfig.create).not.toHaveBeenCalled();

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.saveConfig failed",
                {
                    cause,
                    pageId: "page-1",
                },
            );
        });

        it("returns a database error when creating the config fails", async () => {
            const cause = new Error("Insert failed");

            vi.mocked(prisma.pageConfig.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.pageConfig.create).mockRejectedValue(cause);

            const result = await pageRepository.saveConfig(
                "page-1",
                content,
            );

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "pageRepository.saveConfig failed",
                {
                    cause,
                    pageId: "page-1",
                },
            );
        });
    });
});
