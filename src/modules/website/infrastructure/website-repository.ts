import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError, isNotFoundError } from "@/lib/db/prisma-errors";
import type { Prisma, Website, Theme } from "@prisma/client";

export type WebsiteWithTheme = Website & { theme: Theme | null };

/**
 * Repository layer: the ONLY place in the application allowed to call
 * Prisma directly for Website/Theme data. Every method returns a Result
 * so callers (the service layer) never need to wrap this in try/catch.
 */
export const websiteRepository = {
    async findAll(): Promise<Result<WebsiteWithTheme[], AppError>> {
        try {
            const websites = await prisma.website.findMany({
                include: { theme: true },
                orderBy: { updatedAt: "desc" },
            });
            return ok(websites);
        } catch (cause) {
            logger.error("websiteRepository.findAll failed", { cause });
            return err(AppErrors.database(cause));
        }
    },

    async findById(id: string): Promise<Result<WebsiteWithTheme | null, AppError>> {
        try {
            const website = await prisma.website.findUnique({
                where: { id },
                include: { theme: true },
            });
            return ok(website);
        } catch (cause) {
            logger.error("websiteRepository.findById failed", { cause, id });
            return err(AppErrors.database(cause));
        }
    },

    async findBySlug(slug: string): Promise<Result<WebsiteWithTheme | null, AppError>> {
        try {
            const website = await prisma.website.findUnique({
                where: { slug },
                include: { theme: true },
            });
            return ok(website);
        } catch (cause) {
            logger.error("websiteRepository.findBySlug failed", { cause, slug });
            return err(AppErrors.database(cause));
        }
    },

    async create(input: {
        name: string;
        slug: string;
        description?: string;
        templateKey: string;
        theme: Omit<Prisma.ThemeCreateInput, "website">;
    }): Promise<Result<WebsiteWithTheme, AppError>> {
        try {
            const website = await prisma.website.create({
                data: {
                    name: input.name,
                    slug: input.slug,
                    description: input.description,
                    templateKey: input.templateKey,
                    theme: { create: input.theme },
                },
                include: { theme: true },
            });
            return ok(website);
        } catch (cause: unknown) {
            logger.error("websiteRepository.create failed", { cause, input });
            if (isUniqueConstraintError(cause)) {
                return err(AppErrors.conflict(`A website with slug "${input.slug}" already exists.`));
            }
            return err(AppErrors.database(cause));
        }
    },

    async update(
        id: string,
        input: { name?: string; description?: string }
    ): Promise<Result<WebsiteWithTheme, AppError>> {
        try {
            const website = await prisma.website.update({
                where: { id },
                data: input,
                include: { theme: true },
            });
            return ok(website);
        } catch (cause) {
            logger.error("websiteRepository.update failed", { cause, id });
            if (isNotFoundError(cause)) {
                return err(AppErrors.notFound("Website"));
            }
            return err(AppErrors.database(cause));
        }
    },

    async updateTheme(
        themeId: string,
        input: Partial<{
            primaryColor: string;
            secondaryColor: string;
            accentColor: string;
            headingFont: string;
            bodyFont: string;
            radius: string;
            spacingScale: string;
        }>
    ): Promise<Result<Theme, AppError>> {
        try {
            const theme = await prisma.theme.update({ where: { id: themeId }, data: input });
            return ok(theme);
        } catch (cause) {
            logger.error("websiteRepository.updateTheme failed", { cause, themeId });
            if (isNotFoundError(cause)) {
                return err(AppErrors.notFound("Theme"));
            }
            return err(AppErrors.database(cause));
        }
    },
};

