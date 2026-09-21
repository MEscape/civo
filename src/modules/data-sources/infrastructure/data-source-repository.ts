import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError, isNotFoundError } from "@/lib/db/prisma-errors";
import { Prisma } from "@prisma/client";
import type { DataSource as PrismaDataSource } from "@prisma/client";
import type { DataSourceDataset, DataSourceStatus } from "@/modules/data-sources/domain/data-source-schema";

/**
 * The repository's named alias for the Prisma-generated DataSource model.
 *
 * Mirrors `WebsiteWithTheme` (website-repository.ts) and `PageWithConfig`
 * (page-repository.ts): Prisma types are named here once and re-exported
 * from the service — everything above the infrastructure layer imports
 * this alias, never `DataSource` from `@prisma/client` directly.
 *
 * `DataSource` has no relations, so the alias is a direct rename. If a
 * relation is added later (e.g. `website: Website`) only this file changes.
 */
export type DataSourceRow = PrismaDataSource;


/**
 * Repository layer: the ONLY place in the application allowed to call
 * `prisma.dataSource` directly (spec §21 provider-abstraction boundary —
 * everything above this reads through the resolver in
 * data-source-resolver.ts or the service in data-source-service.ts, never
 * Prisma).
 */
export const dataSourceRepository = {
    async findByWebsite(websiteId: string): Promise<Result<PrismaDataSource[], AppError>> {
        try {
            const rows = await prisma.dataSource.findMany({
                where: { websiteId },
                orderBy: { createdAt: "asc" },
            });
            return ok(rows);
        } catch (cause) {
            logger.error("dataSourceRepository.findByWebsite failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async findById(id: string): Promise<Result<PrismaDataSource | null, AppError>> {
        try {
            const row = await prisma.dataSource.findUnique({ where: { id } });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.findById failed", { cause, id });
            return err(AppErrors.database(cause));
        }
    },

    /** The single row a website has configured for a given dataset (civic or smart-city), if any. */
    async findByWebsiteAndDataset(
        websiteId: string,
        dataset: DataSourceDataset
    ): Promise<Result<PrismaDataSource | null, AppError>> {
        try {
            const row = await prisma.dataSource.findUnique({
                where: { websiteId_dataset: { websiteId, dataset } },
            });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.findByWebsiteAndDataset failed", { cause, websiteId, dataset });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Creates or replaces the one configured source for a (website, dataset)
     * pair. Changing `kind` or `config` invalidates any prior mapping and
     * test-connection status, since both were computed against the old
     * source's shape — see spec §9 "discovery, not yet canonical mapping"
     * (a new source has nothing mapped yet) and §29 (stale diagnostics are
     * worse than none).
     */
    async upsert(input: {
        websiteId: string;
        dataset: DataSourceDataset;
        name: string;
        kind: PrismaDataSource["kind"];
        config: Prisma.InputJsonValue;
    }): Promise<Result<PrismaDataSource, AppError>> {
        try {
            const row = await prisma.dataSource.upsert({
                where: { websiteId_dataset: { websiteId: input.websiteId, dataset: input.dataset } },
                create: {
                    websiteId: input.websiteId,
                    dataset: input.dataset,
                    name: input.name,
                    kind: input.kind,
                    config: input.config,
                },
                update: {
                    name: input.name,
                    kind: input.kind,
                    config: input.config,
                    // Prisma requires Prisma.DbNull to clear a nullable
                    // Json? column — plain `null` is rejected by the type
                    // system (it reads as NullableJsonNullValueInput, not
                    // a valid Json? assignment).
                    mapping: Prisma.DbNull,
                    status: "UNKNOWN",
                    lastCheckedAt: null,
                    lastError: null,
                },
            });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.upsert failed", { cause, input });
            if (isUniqueConstraintError(cause)) {
                return err(AppErrors.conflict("A data source for this dataset already exists."));
            }
            if (isNotFoundError(cause)) {
                return err(AppErrors.notFound("Website"));
            }
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Records the outcome of a test-connection or live-fetch attempt
     * (spec §6, §29). `lastError` is a short, user-safe diagnostic string
     * (e.g. "Unauthorized", "Request timed out") — never a raw exception
     * message or stack trace, which could leak internal detail (spec §29:
     * "Do not log API keys, bearer tokens, passwords...").
     */
    async recordTestResult(
        id: string,
        result: { status: DataSourceStatus; lastError: string | null }
    ): Promise<Result<PrismaDataSource, AppError>> {
        try {
            const row = await prisma.dataSource.update({
                where: { id },
                data: { status: result.status, lastError: result.lastError, lastCheckedAt: new Date() },
            });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.recordTestResult failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Data source"));
            return err(AppErrors.database(cause));
        }
    },

    /** Persists a completed field mapping for a data source (spec §9). */
    async saveMapping(id: string, mapping: Prisma.InputJsonValue): Promise<Result<PrismaDataSource, AppError>> {
        try {
            const row = await prisma.dataSource.update({ where: { id }, data: { mapping } });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.saveMapping failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Data source"));
            return err(AppErrors.database(cause));
        }
    },

    async delete(id: string): Promise<Result<void, AppError>> {
        try {
            await prisma.dataSource.delete({ where: { id } });
            return ok(undefined);
        } catch (cause) {
            logger.error("dataSourceRepository.delete failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Data source"));
            return err(AppErrors.database(cause));
        }
    },
};
