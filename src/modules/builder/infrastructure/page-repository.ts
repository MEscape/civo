import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import type { Prisma } from "@prisma/client";

import { toPageView, toPageConfigView, type PageView, type PageConfigView } from "@/modules/builder/domain/page-schema";

/**
 * Repository layer for Page + PageConfig. The MVP always keeps a single
 * PageConfig row per Page (see schema comment), but the repository shape
 * already returns the config list so a future draft/publish flow with
 * multiple revisions doesn't require a repository rewrite.
 */
export const pageRepository = {
    async findByWebsiteId(websiteId: string): Promise<Result<PageView[], AppError>> {
        try {
            const pages = await prisma.page.findMany({
                where: { websiteId },
                include: { configs: { orderBy: { version: "desc" }, take: 1 } },
                orderBy: { createdAt: "asc" },
            });
            return ok(pages.map(toPageView));
        } catch (cause) {
            logger.error("pageRepository.findByWebsiteId failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async findById(id: string): Promise<Result<PageView | null, AppError>> {
        try {
            const page = await prisma.page.findUnique({
                where: { id },
                include: { configs: { orderBy: { version: "desc" }, take: 1 } },
            });
            return ok(page ? toPageView(page) : null);
        } catch (cause) {
            logger.error("pageRepository.findById failed", { cause, id });
            return err(AppErrors.database(cause));
        }
    },

    async findByWebsiteAndPath(
        websiteId: string,
        path: string
    ): Promise<Result<PageView | null, AppError>> {
        try {
            const page = await prisma.page.findUnique({
                where: { websiteId_path: { websiteId, path } },
                include: { configs: { orderBy: { version: "desc" }, take: 1 } },
            });
            return ok(page ? toPageView(page) : null);
        } catch (cause) {
            logger.error("pageRepository.findByWebsiteAndPath failed", { cause, websiteId, path });
            return err(AppErrors.database(cause));
        }
    },

    async create(input: {
        websiteId: string;
        path: string;
        title: string;
        content: Prisma.InputJsonValue;
    }): Promise<Result<PageView, AppError>> {
        try {
            const page = await prisma.page.create({
                data: {
                    websiteId: input.websiteId,
                    path: input.path,
                    title: input.title,
                    configs: { create: { content: input.content } },
                },
                include: { configs: true },
            });
            return ok(toPageView(page));
        } catch (cause) {
            logger.error("pageRepository.create failed", { cause, input: { ...input, content: "omitted" } });
            if (isUniqueConstraintError(cause)) {
                return err(AppErrors.conflict(`Eine Seite mit dem Pfad "${input.path}" existiert bereits auf dieser Website.`));
            }
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Saves a new PageConfig content snapshot for a page. Increments the
     * version number. In the MVP there is no separate "publish" step — this
     * is effectively both draft-save and publish — but the shape (an
     * explicit version increment) keeps a future revision history additive.
     */
    async saveConfig(
        pageId: string,
        content: Prisma.InputJsonValue
    ): Promise<Result<PageConfigView, AppError>> {
        try {
            const latest = await prisma.pageConfig.findFirst({
                where: { pageId },
                orderBy: { version: "desc" },
            });

            const config = await prisma.pageConfig.create({
                data: {
                    pageId,
                    content,
                    version: (latest?.version ?? 0) + 1,
                    status: "PUBLISHED",
                },
            });
            return ok(toPageConfigView(config));
        } catch (cause) {
            logger.error("pageRepository.saveConfig failed", { cause, pageId });
            return err(AppErrors.database(cause));
        }
    },
};
