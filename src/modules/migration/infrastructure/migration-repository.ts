import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import type { Prisma, Migration } from "@prisma/client";

/**
 * Repository layer for Migration (audit/history only — see the Prisma
 * schema's comment on this model; nothing here is read by any rendering
 * or publishing code path).
 */
export const migrationRepository = {
    async recordProposed(
        websiteId: string,
        sourceReleaseId: string,
        planSnapshot: Prisma.InputJsonValue
    ): Promise<Result<Migration, AppError>> {
        try {
            const migration = await prisma.migration.create({
                data: {
                    websiteId,
                    sourceReleaseId,
                    status: "PROPOSED",
                    planSnapshot,
                    resolutions: {},
                },
            });
            return ok(migration);
        } catch (cause) {
            logger.error("migrationRepository.recordProposed failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async markApplied(
        migrationId: string,
        resolutions: Prisma.InputJsonValue
    ): Promise<Result<Migration, AppError>> {
        try {
            const migration = await prisma.migration.update({
                where: { id: migrationId },
                data: { status: "APPLIED", resolutions, appliedAt: new Date() },
            });
            return ok(migration);
        } catch (cause) {
            logger.error("migrationRepository.markApplied failed", { cause, migrationId });
            return err(AppErrors.database(cause));
        }
    },

    async findHistoryByWebsiteId(websiteId: string): Promise<Result<Migration[], AppError>> {
        try {
            const migrations = await prisma.migration.findMany({
                where: { websiteId },
                orderBy: { createdAt: "desc" },
            });
            return ok(migrations);
        } catch (cause) {
            logger.error("migrationRepository.findHistoryByWebsiteId failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },
};
