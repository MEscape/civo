import { beforeEach, describe, expect, it, vi } from "vitest";
import { websiteService } from "./website-service";
import {
    websiteRepository,
} from "@/modules/website/infrastructure/website-repository";
import { pageService } from "@/modules/builder/application/page-service";
import {
    createWebsiteSchema,
    updateWebsiteSchema,
    themeInputSchema,
    type WebsiteView,
} from "@/modules/website/domain/website-schema";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { getTemplate } from "@/modules/website/domain/templates";

vi.mock(
    "@/modules/website/infrastructure/website-repository",
    () => ({
        websiteRepository: {
            findAll: vi.fn(),
            findById: vi.fn(),
            findBySlug: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateTheme: vi.fn(),
        },
    }),
);

vi.mock(
    "@/modules/builder/application/page-service",
    () => ({
        pageService: {
            systemCreate: vi.fn(),
        },
    }),
);

vi.mock(
    "@/modules/website/domain/website-schema",
    async () => {
        const actual = await vi.importActual<
            typeof import("@/modules/website/domain/website-schema")
        >("@/modules/website/domain/website-schema");

        return {
            ...actual,
            createWebsiteSchema: {
                safeParse: vi.fn(),
            },
            updateWebsiteSchema: {
                safeParse: vi.fn(),
            },
            themeInputSchema: {
                partial: vi.fn(),
            },
        };
    },
);

vi.mock(
    "@/modules/builder/domain/page-schema",
    async () => {
        const actual = await vi.importActual<
            typeof import("@/modules/builder/domain/page-schema")
        >("@/modules/builder/domain/page-schema");

        return {
            ...actual,
            pageConfigSchema: {
                safeParse: vi.fn(),
            },
        };
    },
);

vi.mock("@/modules/website/domain/templates", () => ({
    getTemplate: vi.fn(),
}));

describe("websiteService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("delegates to websiteRepository.findAll", async () => {
            const websites: WebsiteView[] = [
                {
                    id: "website-1",
                    name: "Test Website",
                    slug: "test-website",
                    description: null,
                    templateKey: "default",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    theme: null,
                },
            ];

            vi.mocked(websiteRepository.findAll).mockResolvedValue({
                ok: true,
                data: websites,
            });

            const result = await websiteService.list();

            expect(result).toEqual({
                ok: true,
                data: websites,
            });

            expect(websiteRepository.findAll).toHaveBeenCalledOnce();
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: { code: "DATABASE_ERROR" },
            } as never;

            vi.mocked(websiteRepository.findAll).mockResolvedValue(error);

            const result = await websiteService.list();

            expect(result).toBe(error);
        });
    });

    describe("getById", () => {
        it("returns the website when found", async () => {
            const website = {
                id: "website-1",
                name: "My Website",
                slug: "my-website",
                theme: null,
            };

            vi.mocked(websiteRepository.findById).mockResolvedValue({
                ok: true,
                data: website as never,
            });

            const result = await websiteService.getById("website-1");

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(websiteRepository.findById).toHaveBeenCalledWith(
                "website-1",
            );
        });

        it("returns a not-found error when the repository returns null", async () => {
            vi.mocked(websiteRepository.findById).mockResolvedValue({
                ok: true,
                data: null,
            });

            const result = await websiteService.getById("missing");

            expect(result.ok).toBe(false);
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: { code: "DATABASE_ERROR" },
            } as never;

            vi.mocked(websiteRepository.findById).mockResolvedValue(error);

            const result = await websiteService.getById("website-1");

            expect(result).toBe(error);
        });
    });

    describe("getBySlug", () => {
        it("returns the website when found", async () => {
            const website = {
                id: "website-1",
                name: "My Website",
                slug: "my-website",
                theme: null,
            };

            vi.mocked(websiteRepository.findBySlug).mockResolvedValue({
                ok: true,
                data: website as never,
            });

            const result = await websiteService.getBySlug("my-website");

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(websiteRepository.findBySlug).toHaveBeenCalledWith(
                "my-website",
            );
        });

        it("returns a not-found error when the repository returns null", async () => {
            vi.mocked(websiteRepository.findBySlug).mockResolvedValue({
                ok: true,
                data: null,
            });

            const result = await websiteService.getBySlug("missing");

            expect(result.ok).toBe(false);
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: { code: "DATABASE_ERROR" },
            } as never;

            vi.mocked(websiteRepository.findBySlug).mockResolvedValue(error);

            const result = await websiteService.getBySlug("my-website");

            expect(result).toBe(error);
        });
    });

    describe("create", () => {
        const validInput = {
            name: "My Website",
            slug: "my-website",
            description: "A website",
            templateKey: "starter",
        };

        const homeConfig = {
            type: "page" as const,
            children: [],
        };

        it("rejects invalid input", async () => {
            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Name is required",
                            path: ["name"],
                        },
                    ],
                },
            } as never);

            const result = await websiteService.create({
                slug: "my-website",
            });

            expect(result.ok).toBe(false);
            expect(websiteRepository.create).not.toHaveBeenCalled();
            expect(getTemplate).not.toHaveBeenCalled();
        });

        it("rejects an unknown template", async () => {
            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(getTemplate).mockReturnValue(undefined);

            const result = await websiteService.create(validInput);

            expect(result.ok).toBe(false);
            expect(getTemplate).toHaveBeenCalledWith("starter");
            expect(websiteRepository.create).not.toHaveBeenCalled();
        });

        it("rejects an invalid configuration generated by the template", async () => {
            const template = {
                generateHomePageConfig: vi.fn().mockReturnValue({
                    invalid: true,
                }),
            };

            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(getTemplate).mockReturnValue(template as never);
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Invalid generated config",
                            path: ["children"],
                        },
                    ],
                },
            } as never);

            const result = await websiteService.create(validInput);

            expect(result.ok).toBe(false);
            expect(template.generateHomePageConfig).toHaveBeenCalledOnce();
            expect(websiteRepository.create).not.toHaveBeenCalled();
            expect(pageService.systemCreate).not.toHaveBeenCalled();
        });

        it("creates the website and seeds its home page from the template", async () => {
            const template = {
                generateHomePageConfig: vi.fn().mockReturnValue(homeConfig),
            };

            const website = {
                id: "website-1",
                name: validInput.name,
                slug: validInput.slug,
                description: validInput.description,
                templateKey: validInput.templateKey,
                theme: { id: "theme-1" },
            };

            const page = {
                id: "page-1",
                websiteId: "website-1",
                path: "",
                title: "Startseite",
                configs: [],
            };

            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(getTemplate).mockReturnValue(template as never);
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: homeConfig,
            } as never);
            vi.mocked(websiteRepository.create).mockResolvedValue({
                ok: true,
                data: website as never,
            });
            vi.mocked(pageService.systemCreate).mockResolvedValue({
                ok: true,
                data: page as never,
            });

            const result = await websiteService.create(validInput);

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(websiteRepository.create).toHaveBeenCalledWith({
                name: validInput.name,
                slug: validInput.slug,
                description: validInput.description,
                templateKey: validInput.templateKey,
                theme: {},
            });

            expect(pageService.systemCreate).toHaveBeenCalledWith(
                "website-1",
                "",
                "Startseite",
                homeConfig,
            );
        });

        it("propagates a website repository error without creating a page", async () => {
            const template = {
                generateHomePageConfig: vi.fn().mockReturnValue(homeConfig),
            };
            const error = {
                ok: false,
                error: { code: "CONFLICT" },
            } as never;

            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(getTemplate).mockReturnValue(template as never);
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: homeConfig,
            } as never);
            vi.mocked(websiteRepository.create).mockResolvedValue(error);

            const result = await websiteService.create(validInput);

            expect(result).toBe(error);
            expect(pageService.systemCreate).not.toHaveBeenCalled();
        });

        it("returns the page error when website creation succeeds but home page creation fails", async () => {
            const template = {
                generateHomePageConfig: vi.fn().mockReturnValue(homeConfig),
            };
            const website = {
                id: "website-1",
                name: validInput.name,
                slug: validInput.slug,
                theme: null,
            };
            const pageError = {
                ok: false,
                error: { code: "DATABASE_ERROR" },
            } as never;

            vi.mocked(createWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(getTemplate).mockReturnValue(template as never);
            vi.mocked(pageConfigSchema.safeParse).mockReturnValue({
                success: true,
                data: homeConfig,
            } as never);
            vi.mocked(websiteRepository.create).mockResolvedValue({
                ok: true,
                data: website as never,
            });
            vi.mocked(pageService.systemCreate).mockResolvedValue(pageError);

            const result = await websiteService.create(validInput);

            expect(result).toStrictEqual(pageError);
        });
    });

    describe("update", () => {
        const validInput = {
            id: "website-1",
            name: "Updated Website",
            description: "Updated description",
        };

        it("rejects invalid input", async () => {
            vi.mocked(updateWebsiteSchema.safeParse).mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Invalid website",
                            path: ["name"],
                        },
                    ],
                },
            } as never);

            const result = await websiteService.update({
                id: "website-1",
            });

            expect(result.ok).toBe(false);
            expect(websiteRepository.update).not.toHaveBeenCalled();
        });

        it("updates a website with the validated fields", async () => {
            const website = {
                id: "website-1",
                name: validInput.name,
                description: validInput.description,
                slug: "my-website",
                theme: null,
            };

            vi.mocked(updateWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(websiteRepository.update).mockResolvedValue({
                ok: true,
                data: website as never,
            });

            const result = await websiteService.update(validInput);

            expect(result).toEqual({
                ok: true,
                data: website,
            });

            expect(websiteRepository.update).toHaveBeenCalledWith(
                "website-1",
                {
                    name: validInput.name,
                    description: validInput.description,
                },
            );
        });

        it("propagates repository errors", async () => {
            const error = {
                ok: false,
                error: { code: "NOT_FOUND" },
            } as never;

            vi.mocked(updateWebsiteSchema.safeParse).mockReturnValue({
                success: true,
                data: validInput,
            } as never);
            vi.mocked(websiteRepository.update).mockResolvedValue(error);

            const result = await websiteService.update(validInput);

            expect(result).toBe(error);
        });
    });

    describe("updateTheme", () => {
        const validInput = {
            primaryColor: "#111111",
            secondaryColor: "#222222",
        };

        it("rejects invalid theme input", async () => {
            const safeParse = vi.fn().mockReturnValue({
                success: false,
                error: {
                    issues: [
                        {
                            message: "Invalid color",
                            path: ["primaryColor"],
                        },
                    ],
                },
            });

            vi.mocked(themeInputSchema.partial).mockReturnValue({
                safeParse,
            } as never);

            const result = await websiteService.updateTheme(
                "theme-1",
                { primaryColor: "not-a-color" },
            );

            expect(result.ok).toBe(false);
            expect(safeParse).toHaveBeenCalledWith({
                primaryColor: "not-a-color",
            });
            expect(websiteRepository.updateTheme).not.toHaveBeenCalled();
        });

        it("updates a theme with the parsed input", async () => {
            const parsedTheme = {
                primaryColor: "#111111",
                secondaryColor: "#222222",
            };
            const safeParse = vi.fn().mockReturnValue({
                success: true,
                data: parsedTheme,
            });

            const theme = {
                id: "theme-1",
                ...parsedTheme,
            };

            vi.mocked(themeInputSchema.partial).mockReturnValue({
                safeParse,
            } as never);
            vi.mocked(websiteRepository.updateTheme).mockResolvedValue({
                ok: true,
                data: theme as never,
            });

            const result = await websiteService.updateTheme(
                "theme-1",
                validInput,
            );

            expect(result).toEqual({
                ok: true,
                data: theme,
            });

            expect(websiteRepository.updateTheme).toHaveBeenCalledWith(
                "theme-1",
                parsedTheme,
            );
        });

        it("propagates repository errors", async () => {
            const safeParse = vi.fn().mockReturnValue({
                success: true,
                data: validInput,
            });
            const error = {
                ok: false,
                error: { code: "NOT_FOUND" },
            } as never;

            vi.mocked(themeInputSchema.partial).mockReturnValue({
                safeParse,
            } as never);
            vi.mocked(websiteRepository.updateTheme).mockResolvedValue(error);

            const result = await websiteService.updateTheme(
                "theme-1",
                validInput,
            );

            expect(result).toBe(error);
        });
    });
});
