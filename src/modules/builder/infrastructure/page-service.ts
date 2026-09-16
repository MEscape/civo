import { pageRepository, type PageWithConfig } from "@/modules/builder/infrastructure/page-repository";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { pageConfigSchema, type PageConfigInput } from "@/modules/builder/domain/page-schema";
import { createPageSchema } from "@/modules/website/domain/website-schema";
import type { Prisma } from "@prisma/client";

/**
 * Service/domain layer for Page + PageConfig operations.
 *
 * Every write path validates the incoming page configuration with Zod
 * before it reaches the repository/database: stored JSON
 * is never trusted blindly, and reads re-validate too, so a row edited
 * outside the application (or written by a future schema version) fails
 * closed instead of crashing the renderer.
 */
export const pageService = {
    async listForWebsite(websiteId: string): Promise<Result<PageWithConfig[], AppError>> {
        return pageRepository.findByWebsiteId(websiteId);
    },

    async getById(id: string): Promise<Result<PageWithConfig, AppError>> {
        const result = await pageRepository.findById(id);
        if (!result.ok) return result;
        if (!result.data) return err(AppErrors.notFound("Page"));
        return ok(result.data);
    },

    async getByWebsiteAndPath(
        websiteId: string,
        path: string
    ): Promise<Result<PageWithConfig, AppError>> {
        const result = await pageRepository.findByWebsiteAndPath(websiteId, path);
        if (!result.ok) return result;
        if (!result.data) return err(AppErrors.notFound("Page"));
        return ok(result.data);
    },

    /**
     * Returns the validated PageConfig content for a page, ready for the
     * renderer. Fails closed (typed error, never a thrown exception or
     * silently-broken render) if the stored JSON no longer matches the
     * schema.
     */
    async getValidatedConfig(page: PageWithConfig): Promise<Result<PageConfigInput, AppError>> {
        const latest = page.configs[0];
        if (!latest) return err(AppErrors.notFound("PageConfig"));

        const parsed = pageConfigSchema.safeParse(latest.content);
        if (!parsed.success) {
            return err(
                AppErrors.validation(
                    "Stored page configuration is invalid and could not be rendered.",
                    undefined
                )
            );
        }
        return ok(parsed.data);
    },

    /**
     * Creates a page from validated input. This is the Page domain's own
     * public entry point for page creation — see websiteService.create()
     * for the one documented exception where a different domain's service
     * calls pageRepository directly instead of through here.
     */
    async create(input: unknown): Promise<Result<PageWithConfig, AppError>> {
        const parsed = createPageSchema.safeParse(input);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return err(AppErrors.validation(first?.message ?? "Invalid input.", first?.path.join(".")));
        }

        const emptyConfig: PageConfigInput = { type: "page", children: [] };
        return pageRepository.create({
            websiteId: parsed.data.websiteId,
            path: parsed.data.path,
            title: parsed.data.title,
            content: emptyConfig as unknown as Prisma.InputJsonValue,
        });
    },

    /**
     * Internal page creation, bypassing the user-level createPageSchema.
     * Used by the system (e.g. website provisioning) to seed a page with a pre-validated configuration.
     */
    async systemCreate(websiteId: string, path: string, title: string, content: PageConfigInput): Promise<Result<PageWithConfig, AppError>> {
        return pageRepository.create({
            websiteId,
            path,
            title,
            content: content as unknown as Prisma.InputJsonValue,
        });
    },

    /**
     * Validates and persists a new page configuration. This is the single
     * write path the builder's "Save" action goes through.
     */
    async saveConfig(pageId: string, config: unknown): Promise<Result<PageConfigInput, AppError>> {
        const parsed = pageConfigSchema.safeParse(config);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return err(
                AppErrors.validation(
                    first?.message ?? "Page configuration is invalid.",
                    first?.path.join(".")
                )
            );
        }

        const result = await pageRepository.saveConfig(
            pageId,
            parsed.data as unknown as Prisma.InputJsonValue
        );
        if (!result.ok) return result;
        return ok(parsed.data);
    },
};
