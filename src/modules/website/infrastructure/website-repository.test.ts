import { beforeEach, describe, expect, it, vi } from "vitest";
import { websiteRepository } from "./website-repository";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";
import {
    isUniqueConstraintError,
    isNotFoundError,
} from "@/lib/db/prisma-errors";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        website: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        theme: {
            update: vi.fn(),
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
    isNotFoundError: vi.fn(),
}));

describe("websiteRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isUniqueConstraintError).mockReturnValue(false);
        vi.mocked(isNotFoundError).mockReturnValue(false);
    });

    describe("findAll", () => {
        it("returns all websites with their themes ordered by most recently updated", async () => {
            const websites = [
                {
                    id: "website-1",
                    name: "Website 1",
                    slug: "website-1",
                    theme: { id: "theme-1" },
                },
            ];

            vi.mocked(prisma.website.findMany).mockResolvedValue(
                websites as never,
            );

            const result = await websiteRepository.findAll();

            expect(result).toEqual({
                ok: true,
                data: websites,
            });

            expect(prisma.website.findMany).toHaveBeenCalledWith({
                include: { theme: true },
                orderBy: { updatedAt: "desc" },
            });
        });

        it("returns an empty array when no websites exist", async () => {
            vi.mocked(prisma.website.findMany).mockResolvedValue([]);

            const result = await websiteRepository.findAll();

            expect(result).toEqual({
                ok: true,
                data: [],
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.website.findMany).mockRejectedValue(cause);

            const result = await websiteRepository.findAll();

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.findAll failed",
                { cause },
            );
        });
    });

    describe("findById", () => {
        it("returns the website when found", async () => {
            const website = {
                id: "website-1",
                name: "My Website",
                slug: "my-website",
                theme: { id: "theme-1" },
            };

            vi.mocked(prisma.website.findUnique).mockResolvedValue(
                website as never,
            );

            const result = await websiteRepository.findById("website-1");

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(prisma.website.findUnique).toHaveBeenCalledWith({
                where: { id: "website-1" },
                include: { theme: true },
            });
        });

        it("returns null when the website does not exist", async () => {
            vi.mocked(prisma.website.findUnique).mockResolvedValue(null);

            const result = await websiteRepository.findById("missing");

            expect(result).toEqual({
                ok: true,
                data: null,
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Connection failed");

            vi.mocked(prisma.website.findUnique).mockRejectedValue(cause);

            const result = await websiteRepository.findById("website-1");

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.findById failed",
                {
                    cause,
                    id: "website-1",
                },
            );
        });
    });

    describe("findBySlug", () => {
        it("returns the website when found", async () => {
            const website = {
                id: "website-1",
                name: "My Website",
                slug: "my-website",
                theme: { id: "theme-1" },
            };

            vi.mocked(prisma.website.findUnique).mockResolvedValue(
                website as never,
            );

            const result = await websiteRepository.findBySlug("my-website");

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(prisma.website.findUnique).toHaveBeenCalledWith({
                where: { slug: "my-website" },
                include: { theme: true },
            });
        });

        it("returns null when no website matches the slug", async () => {
            vi.mocked(prisma.website.findUnique).mockResolvedValue(null);

            const result = await websiteRepository.findBySlug("missing");

            expect(result).toEqual({
                ok: true,
                data: null,
            });
        });

        it("returns a database error when Prisma fails", async () => {
            const cause = new Error("Database error");

            vi.mocked(prisma.website.findUnique).mockRejectedValue(cause);

            const result = await websiteRepository.findBySlug("my-website");

            expect(result.ok).toBe(false);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.findBySlug failed",
                {
                    cause,
                    slug: "my-website",
                },
            );
        });
    });

    describe("create", () => {
        const input = {
            name: "My Website",
            slug: "my-website",
            description: "A website",
            templateKey: "starter",
            theme: {
                primaryColor: "#000000",
                secondaryColor: "#ffffff",
            },
        };

        it("creates a website with its theme", async () => {
            const website = {
                id: "website-1",
                name: input.name,
                slug: input.slug,
                description: input.description,
                templateKey: input.templateKey,
                theme: {
                    id: "theme-1",
                    primaryColor: "#000000",
                    secondaryColor: "#ffffff",
                },
            };

            vi.mocked(prisma.website.create).mockResolvedValue(
                website as never,
            );

            const result = await websiteRepository.create(input);

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(prisma.website.create).toHaveBeenCalledWith({
                data: {
                    name: input.name,
                    slug: input.slug,
                    description: input.description,
                    templateKey: input.templateKey,
                    theme: { create: input.theme },
                },
                include: { theme: true },
            });
        });

        it("creates a website without a description when it is omitted", async () => {
            const inputWithoutDescription = {
                name: "My Website",
                slug: "my-website",
                templateKey: "starter",
                theme: {},
            };

            const website = {
                id: "website-1",
                name: inputWithoutDescription.name,
                slug: inputWithoutDescription.slug,
                templateKey: inputWithoutDescription.templateKey,
                theme: { id: "theme-1" },
            };

            vi.mocked(prisma.website.create).mockResolvedValue(
                website as never,
            );

            const result = await websiteRepository.create(
                inputWithoutDescription,
            );

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(prisma.website.create).toHaveBeenCalledWith({
                data: {
                    name: "My Website",
                    slug: "my-website",
                    description: undefined,
                    templateKey: "starter",
                    theme: { create: {} },
                },
                include: { theme: true },
            });
        });

        it("maps a unique constraint error to a conflict error", async () => {
            const cause = new Error("Unique constraint failed");

            vi.mocked(prisma.website.create).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(true);

            const result = await websiteRepository.create(input);

            expect(result.ok).toBe(false);

            expect(isUniqueConstraintError).toHaveBeenCalledWith(cause);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.create failed",
                {
                    cause,
                    input,
                },
            );
        });

        it("maps non-unique Prisma errors to database errors", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.website.create).mockRejectedValue(cause);
            vi.mocked(isUniqueConstraintError).mockReturnValue(false);

            const result = await websiteRepository.create(input);

            expect(result.ok).toBe(false);
            expect(isUniqueConstraintError).toHaveBeenCalledWith(cause);
        });
    });

    describe("update", () => {
        const input = {
            name: "Updated Website",
            description: "Updated description",
        };

        it("updates a website and includes its theme", async () => {
            const website = {
                id: "website-1",
                name: input.name,
                description: input.description,
                slug: "my-website",
                theme: { id: "theme-1" },
            };

            vi.mocked(prisma.website.update).mockResolvedValue(
                website as never,
            );

            const result = await websiteRepository.update(
                "website-1",
                input,
            );

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(prisma.website.update).toHaveBeenCalledWith({
                where: { id: "website-1" },
                data: input,
                include: { theme: true },
            });
        });

        it("returns a not-found error when the website does not exist", async () => {
            const cause = new Error("Record not found");

            vi.mocked(prisma.website.update).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(true);

            const result = await websiteRepository.update(
                "missing",
                input,
            );

            expect(result.ok).toBe(false);
            expect(isNotFoundError).toHaveBeenCalledWith(cause);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.update failed",
                {
                    cause,
                    id: "missing",
                },
            );
        });

        it("maps non-not-found Prisma errors to database errors", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.website.update).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(false);

            const result = await websiteRepository.update(
                "website-1",
                input,
            );

            expect(result.ok).toBe(false);
            expect(isNotFoundError).toHaveBeenCalledWith(cause);
        });
    });

    describe("updateTheme", () => {
        const input = {
            primaryColor: "#111111",
            secondaryColor: "#222222",
            accentColor: "#333333",
            headingFont: "Inter",
            bodyFont: "Inter",
            radius: "md",
            spacingScale: "comfortable",
        };

        it("updates a theme", async () => {
            const theme = {
                id: "theme-1",
                ...input,
                createdAt: new Date("2026-09-01"),
                updatedAt: new Date("2026-09-01"),
            };

            vi.mocked(prisma.theme.update).mockResolvedValue(theme as never);

            const result = await websiteRepository.updateTheme(
                "theme-1",
                input,
            );

            expect(result).toEqual({
                ok: true,
                data: theme,
            });

            expect(prisma.theme.update).toHaveBeenCalledWith({
                where: { id: "theme-1" },
                data: input,
            });
        });

        it("supports partial theme updates", async () => {
            const input = { primaryColor: "#123456" };
            const theme = {
                id: "theme-1",
                primaryColor: input.primaryColor,
                createdAt: new Date("2026-09-01"),
                updatedAt: new Date("2026-09-01"),
            };

            vi.mocked(prisma.theme.update).mockResolvedValue(theme as never);

            const result = await websiteRepository.updateTheme(
                "theme-1",
                input,
            );

            expect(result).toEqual({
                ok: true,
                data: theme,
            });

            expect(prisma.theme.update).toHaveBeenCalledWith({
                where: { id: "theme-1" },
                data: input,
            });
        });

        it("returns a not-found error when the theme does not exist", async () => {
            const cause = new Error("Record not found");

            vi.mocked(prisma.theme.update).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(true);

            const result = await websiteRepository.updateTheme(
                "missing-theme",
                { primaryColor: "#123456" },
            );

            expect(result.ok).toBe(false);
            expect(isNotFoundError).toHaveBeenCalledWith(cause);

            expect(logger.error).toHaveBeenCalledWith(
                "websiteRepository.updateTheme failed",
                {
                    cause,
                    themeId: "missing-theme",
                },
            );
        });

        it("maps non-not-found Prisma errors to database errors", async () => {
            const cause = new Error("Database unavailable");

            vi.mocked(prisma.theme.update).mockRejectedValue(cause);
            vi.mocked(isNotFoundError).mockReturnValue(false);

            const result = await websiteRepository.updateTheme(
                "theme-1",
                { primaryColor: "#123456" },
            );

            expect(result.ok).toBe(false);
            expect(isNotFoundError).toHaveBeenCalledWith(cause);
        });
    });
});
