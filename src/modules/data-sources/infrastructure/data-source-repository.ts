import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError, isNotFoundError } from "@/lib/db/prisma-errors";
import type { DataSource as PrismaDataSource, Prisma } from "@prisma/client";
import type { DataSourceDataset } from "@/modules/data-sources/domain/data-source-schema";

/**
 * Repository layer: the ONLY place in the application allowed to call
 * `prisma.dataSource` directly (spec §21 provider-abstraction boundary —
 * everything above this reads through the resolver in
 * data-source-resolver.ts, never Prisma).
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

    /**
     * The single row a website has configured for a given dataset (civic
     * or smart-city), if any. `dataset` is not a real Prisma column (the
     * schema keeps `DataSource` deliberately minimal — see prisma/schema.prisma)
     * but is derivable from `config` on write; see data-source-resolver.ts
     * for how "one active source per dataset" is enforced today via a
     * fixed `name` convention, and prisma/schema.prisma's own comment on
     * the model for the follow-up to promote this to a real column once a
     * second REST/GraphQL adapter actually exists.
     */
    async findByWebsiteAndDataset(
        websiteId: string,
        dataset: DataSourceDataset
    ): Promise<Result<PrismaDataSource | null, AppError>> {
        try {
            const row = await prisma.dataSource.findFirst({
                where: { websiteId, name: datasetSourceName(dataset) },
            });
            return ok(row);
        } catch (cause) {
            logger.error("dataSourceRepository.findByWebsiteAndDataset failed", { cause, websiteId, dataset });
            return err(AppErrors.database(cause));
        }
    },

    async upsert(input: {
        websiteId: string;
        dataset: DataSourceDataset;
        kind: PrismaDataSource["kind"];
        config: Prisma.InputJsonValue;
    }): Promise<Result<PrismaDataSource, AppError>> {
        try {
            const name = datasetSourceName(input.dataset);
            const row = await prisma.dataSource.upsert({
                where: { websiteId_name: { websiteId: input.websiteId, name } },
                create: { websiteId: input.websiteId, name, kind: input.kind, config: input.config },
                update: { kind: input.kind, config: input.config },
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
};

/**
 * A fixed, predictable `name` per dataset ("civic-primary" /
 * "smartcity-primary") is how "the one data source for this website's
 * civic data" is found without a dedicated `dataset` column — the schema
 * intentionally stayed minimal (spec §22: "the exact database model is
 * up to the existing architecture... keep the MVP implementation safe and
 * simple") rather than adding a column for a distinction the MVP only
 * needs once. If a website ever needs MULTIPLE civic sources (e.g. two
 * REST endpoints for different services), promote `dataset` to a real
 * column and this convention goes away.
 */
function datasetSourceName(dataset: DataSourceDataset): string {
    return dataset === "civic" ? "civic-primary" : "smartcity-primary";
}
