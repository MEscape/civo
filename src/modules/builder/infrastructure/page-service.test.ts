import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageService } from "./page-service";
import { pageRepository, type PageWithConfig } from "@/modules/builder/infrastructure/page-repository";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { createPageSchema } from "@/modules/website/domain/website-schema";

vi.mock("@/modules/builder/infrastructure/page-repository", () => ({
    pageRepository: {
        findByWebsiteId: vi.fn(),
        findById: vi.fn(),
        findByWebsiteAndPath: vi.fn(),
        create: vi.fn(),
        saveConfig: vi.fn(),
    },
}));

vi.mock("@/modules/builder/domain/page-schema", async () => {
    const actual = await vi.importActual<
        typeof import("@/modules/builder/domain/page-schema")
    >("@/modules/builder/domain/page-schema");

    return {
        ...actual,
        pageConfigSchema: {
            safeParse: vi.fn(),
        },
    };
});

vi.mock("@/modules/website/domain/website-schema", async () => {
    const actual = await vi.importActual<
        typeof import("@/modules/website/domain/website-schema")
    >("@/modules/website/domain/website-schema");

    return {
        ...actual,
        createPageSchema: {
            safeParse: vi.fn(),
        },
    };
});

describe("pageService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("listForWebsite", () => {
        it("delegates to pageRepository.findByWebsiteId", async () => {
            const pages = [
                {
                    id: "page-1",
                    websiteId: "website-1",
                    path: "/",
                    title: "Home",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    configs: [],
                },
            ];

            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue({
                ok: true,
                data: pages,
            });

            const result = await pageService.listForWebsite("website-1");

            expect(result).toEqual({
                ok: true,
                data: pages,
            });

            expect(
                pageRepository.findByWebsiteId,
            ).toHaveBeenCalledWith("website-1");
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: {
                    code: "DATABASE_ERROR",
                },
            } as never;

            vi.mocked(pageRepository.findByWebsiteId).mockResolvedValue(error);

            const result = await pageService.listForWebsite("website-1");

            expect(result).toBe(error);
        });
    });

    describe("getById", () => {
        it("returns the page when found", async () => {
            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/",
                title: "Home",
                createdAt: new Date(),
                updatedAt: new Date(),
                configs: [],
            };

            vi.mocked(pageRepository.findById).mockResolvedValue({
                ok: true,
                data: page,
            });

            const result = await pageService.getById("page-1");

            expect(result).toEqual({
                ok: true,
                data: page,
            });
        });

        it("returns a not-found error when the repository returns null", async () => {
            vi.mocked(pageRepository.findById).mockResolvedValue({
                ok: true,
                data: null,
            });

            const result = await pageService.getById("missing");

            expect(result.ok).toBe(false);
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: {
                    code: "DATABASE_ERROR",
                },
            } as never;

            vi.mocked(pageRepository.findById).mockResolvedValue(error);

            const result = await pageService.getById("page-1");

            expect(result).toBe(error);
        });
    });

    describe("getByWebsiteAndPath", () => {
        it("returns the page when found", async () => {
            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/about",
                title: "About",
                createdAt: new Date(),
                updatedAt: new Date(),
                configs: [],
            };

            vi.mocked(
                pageRepository.findByWebsiteAndPath,
            ).mockResolvedValue({
                ok: true,
                data: page,
            });

            const result = await pageService.getByWebsiteAndPath(
                "website-1",
                "/about",
            );

            expect(result).toEqual({
                ok: true,
                data: page,
            });
        });

        it("returns not-found when the page does not exist", async () => {
            vi.mocked(
                pageRepository.findByWebsiteAndPath,
            ).mockResolvedValue({
                ok: true,
                data: null,
            });

            const result = await pageService.getByWebsiteAndPath(
                "website-1",
                "/missing",
            );

            expect(result.ok).toBe(false);
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: {
                    code: "DATABASE_ERROR",
                },
            } as never;

            vi.mocked(
                pageRepository.findByWebsiteAndPath,
            ).mockResolvedValue(error);

            const result = await pageService.getByWebsiteAndPath(
                "website-1",
                "/about",
            );

            expect(result).toBe(error);
        });
    });

    describe("getValidatedConfig", () => {
        const page = {
            id: "page-1",
            websiteId: "website-1",
            path: "/",
            title: "Home",
            createdAt: new Date(),
            updatedAt: new Date(),
            configs: [
                {
                    id: "config-1",
                    pageId: "page-1",
                    version: 1,
                    status: "PUBLISHED",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    content: {
                        type: "page",
                        children: [],
                    },
                },
            ],
        } as PageWithConfig;

        it("returns the validated config", async () => {
            const config = {
                type: "page",
                children: [],
            };

            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: config,
            } as never);

            const result = await pageService.getValidatedConfig(page);

            expect(result).toEqual({
                ok: true,
                data: config,
            });

            expect(pageConfigSchema.safeParse).toHaveBeenCalledWith(
                page.configs[0].content,
            );
        });

        it("returns not-found when the page has no configs", async () => {
            const pageWithoutConfig = {
                ...page,
                configs: [],
            };

            const result = await pageService.getValidatedConfig(
                pageWithoutConfig,
            );

            expect(result.ok).toBe(false);

            expect(pageConfigSchema.safeParse).not.toHaveBeenCalled();
        });

        it("returns validation error when stored config is invalid", async () => {
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Invalid configuration",
                            path: ["children"],
                        },
                    ],
                },
            } as never);

            const result = await pageService.getValidatedConfig(page);

            expect(result.ok).toBe(false);
        });

        it("does not throw when stored JSON is invalid", async () => {
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [],
                },
            } as never);

            await expect(
                pageService.getValidatedConfig(page),
            ).resolves.toMatchObject({
                ok: false,
            });
        });
    });

    describe("create", () => {
        const validInput = {
            websiteId: "website-1",
            path: "/about",
            title: "About",
        };

        it("rejects invalid input", async () => {
            vi.mocked(createPageSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Path is required",
                            path: ["path"],
                        },
                    ],
                },
            } as never);

            const result = await pageService.create({
                websiteId: "website-1",
            });

            expect(result.ok).toBe(false);

            expect(pageRepository.create).not.toHaveBeenCalled();
        });

        it("creates a page with an empty configuration", async () => {
            vi.mocked(createPageSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);

            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/about",
                title: "About",
                createdAt: new Date(),
                updatedAt: new Date(),
                configs: [],
            };

            vi.mocked(pageRepository.create).mockResolvedValue({
                ok: true,
                data: page,
            });

            const result = await pageService.create(validInput);

            expect(result).toEqual({
                ok: true,
                data: page,
            });

            expect(pageRepository.create).toHaveBeenCalledWith({
                websiteId: "website-1",
                path: "/about",
                title: "About",
                content: {
                    type: "page",
                    children: [],
                },
            });
        });

        it("propagates repository errors", async () => {
            vi.mocked(createPageSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);

            const error = {
                ok: false,
                error: {
                    code: "CONFLICT",
                },
            } as never;

            vi.mocked(pageRepository.create).mockResolvedValue(error);

            const result = await pageService.create(validInput);

            expect(result).toBe(error);
        });
    });

    describe("systemCreate", () => {
        it("creates a page with the supplied validated config", async () => {
            const config = {
                type: "page" as const,
                children: [],
            };

            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "/",
                title: "Home",
                createdAt: new Date(),
                updatedAt: new Date(),
                configs: [],
            };

            vi.mocked(pageRepository.create).mockResolvedValue({
                ok: true,
                data: page,
            });

            const result = await pageService.systemCreate(
                "website-1",
                "/",
                "Home",
                config,
            );

            expect(result).toEqual({
                ok: true,
                data: page,
            });

            expect(pageRepository.create).toHaveBeenCalledWith({
                websiteId: "website-1",
                path: "/",
                title: "Home",
                content: config,
            });
        });

        it("propagates repository errors", async () => {
            const config = {
                type: "page" as const,
                children: [],
            };

            const error = {
                ok: false,
                error: {
                    code: "DATABASE_ERROR",
                },
            } as never;

            vi.mocked(pageRepository.create).mockResolvedValue(error);

            const result = await pageService.systemCreate(
                "website-1",
                "/",
                "Home",
                config,
            );

            expect(result).toBe(error);
        });
    });

    describe("saveConfig", () => {
        const validConfig = {
            type: "page",
            children: [],
        };

        it("rejects invalid config", async () => {
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Invalid node",
                            path: ["children", 0],
                        },
                    ],
                },
            } as never);

            const result = await pageService.saveConfig(
                "page-1",
                {
                    type: "invalid",
                },
            );

            expect(result.ok).toBe(false);

            expect(pageRepository.saveConfig).not.toHaveBeenCalled();
        });

        it("persists a valid config", async () => {
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: validConfig,
            } as never);

            vi.mocked(pageRepository.saveConfig).mockResolvedValue({
                ok: true,
                data: {
                    id: "config-1",
                    pageId: "page-1",
                    version: 2,
                    status: "PUBLISHED",
                    content: validConfig,
                },
            } as never);

            const result = await pageService.saveConfig(
                "page-1",
                validConfig,
            );

            expect(result).toEqual({
                ok: true,
                data: validConfig,
            });

            expect(pageRepository.saveConfig).toHaveBeenCalledWith(
                "page-1",
                validConfig,
            );
        });

        it("returns the parsed config rather than the database config", async () => {
            const parsedConfig = {
                type: "page",
                children: [],
            };

            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: parsedConfig,
            } as never);

            vi.mocked(pageRepository.saveConfig).mockResolvedValue({
                ok: true,
                data: {
                    id: "config-1",
                    pageId: "page-1",
                    version: 10,
                    status: "PUBLISHED",
                    content: parsedConfig,
                },
            } as never);

            const result = await pageService.saveConfig(
                "page-1",
                {
                    some: "input",
                },
            );

            expect(result).toEqual({
                ok: true,
                data: parsedConfig,
            });
        });

        it("propagates repository errors", async () => {
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: validConfig,
            } as never);

            const error = {
                ok: false,
                error: {
                    code: "DATABASE_ERROR",
                },
            } as never;

            vi.mocked(pageRepository.saveConfig).mockResolvedValue(error);

            const result = await pageService.saveConfig(
                "page-1",
                validConfig,
            );

            expect(result).toBe(error);
        });
    });
});
