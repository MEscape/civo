import { websiteRepository, type WebsiteWithTheme } from "@/modules/website/infrastructure/website-repository";
export type { WebsiteWithTheme };

import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { pageService } from "@/modules/builder/infrastructure/page-service";
import {
    createWebsiteSchema,
    updateWebsiteSchema,
    themeInputSchema,
    type CreateWebsiteInput,
    type UpdateWebsiteInput,
} from "@/modules/website/domain/website-schema";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { getTemplate } from "@/modules/website/domain/templates";
// Side-effect import: registers every feature module's component
// definitions into the component-platform domain registry before
// getTemplate()'s createDefaultNode() calls can look any of them up.
// Needed here because template instantiation is a server-side entry
// point that never renders through component-platform's render-nodes.tsx
// (see that file's own comment on why it carries this same import) — a
// newly-created website's initial pages are built directly from
// templates, not rendered, until the user opens the builder or visits
// the public site.
import "@/modules/component-platform/infrastructure/definitions";

/**
 * Service/domain layer for Website operations.
 *
 * This is where server-side validation and domain rules live — the
 * boundary a Server Action calls into. Nothing here talks to Prisma
 * directly (see repositories/website-repository.ts); nothing above this
 * layer (Server Actions, route handlers) is allowed to skip validation.
 */
export const websiteService = {
    async list(): Promise<Result<WebsiteWithTheme[], AppError>> {
        return websiteRepository.findAll();
    },

    async getById(id: string): Promise<Result<WebsiteWithTheme, AppError>> {
        const result = await websiteRepository.findById(id);
        if (!result.ok) return result;
        if (!result.data) return err(AppErrors.notFound("Website"));
        return ok(result.data);
    },

    async getBySlug(slug: string): Promise<Result<WebsiteWithTheme, AppError>> {
        const result = await websiteRepository.findBySlug(slug);
        if (!result.ok) return result;
        if (!result.data) return err(AppErrors.notFound("Website"));
        return ok(result.data);
    },

    /**
     * Creates a website from a template. The template is used ONCE, here,
     * to generate the initial page configuration for a home page. After
     * this call the website owns its own PageConfig rows — later changes to
     * the template definition will never retroactively affect this website.
     */
    async create(input: unknown): Promise<Result<WebsiteWithTheme, AppError>> {
        const parsed = createWebsiteSchema.safeParse(input);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return err(AppErrors.validation(first?.message ?? "Invalid input.", first?.path.join(".")));
        }

        const validated: CreateWebsiteInput = parsed.data;
        const template = getTemplate(validated.templateKey);
        if (!template) {
            return err(AppErrors.validation("Unknown template selected.", "templateKey"));
        }

        const homeConfig = template.generateHomePageConfig();
        const configParsed = pageConfigSchema.safeParse(homeConfig);
        if (!configParsed.success) {
            // This would indicate a bug in the template generator itself, not
            // user input — but we still fail closed rather than persist
            // unvalidated JSON.
            return err(AppErrors.internal(configParsed.error));
        }

        const websiteResult = await websiteRepository.create({
            name: validated.name,
            slug: validated.slug,
            description: validated.description,
            templateKey: validated.templateKey,
            theme: {}, // uses Theme model defaults; customized later via updateTheme
        });
        if (!websiteResult.ok) return websiteResult;

        // Now respecting service-layer boundaries by using the dedicated internal method
        const pageResult = await pageService.systemCreate(
            websiteResult.data.id,
            "",
            "Startseite",
            configParsed.data
        );
        if (!pageResult.ok) {
            // Website was created but the home page failed — surface the error;
            // the website record still exists and can have a page added later.
            return err(pageResult.error);
        }

        return ok(websiteResult.data);
    },

    async update(input: unknown): Promise<Result<WebsiteWithTheme, AppError>> {
        const parsed = updateWebsiteSchema.safeParse(input);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return err(AppErrors.validation(first?.message ?? "Invalid input.", first?.path.join(".")));
        }
        const validated: UpdateWebsiteInput = parsed.data;
        return websiteRepository.update(validated.id, {
            name: validated.name,
            description: validated.description,
        });
    },

    async updateTheme(themeId: string, input: unknown): Promise<Result<unknown, AppError>> {
        const parsed = themeInputSchema.partial().safeParse(input);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return err(AppErrors.validation(first?.message ?? "Invalid theme input.", first?.path.join(".")));
        }
        return websiteRepository.updateTheme(themeId, parsed.data);
    },
};