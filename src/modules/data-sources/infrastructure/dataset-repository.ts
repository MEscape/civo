import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isUniqueConstraintError, isNotFoundError } from "@/lib/db/prisma-errors";
import { Prisma } from "@prisma/client";

import type { CanonicalType, DatasetView, CreateDatasetInput, UpdateDatasetInput } from "@/modules/data-sources/domain/dataset-schema";
import { toDatasetView } from "@/modules/data-sources/domain/dataset-schema";
import type { DatasetMapping } from "@/modules/data-sources/domain/field-mapping-schema";
import type { DataSourceStatus } from "@/modules/data-sources/domain/data-source-schema";

function toInputJson(value: Record<string, unknown> | DatasetMapping): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

/** Prisma include shape used everywhere we need the parent DataSource denormalised. */
const withDataSource = {
    dataSource: {
        select: { name: true, kind: true, status: true },
    },
} satisfies Prisma.DatasetInclude;

/**
 * Repository layer: the ONLY place in the application allowed to call
 * `prisma.dataset` directly.
 *
 * Components reference Datasets — never DataSources directly. This
 * repository is the single join point that enforces website-level
 * scoping (via the parent DataSource's websiteId).
 */
export const datasetRepository = {
    /**
     * All datasets belonging to a specific DataSource.
     */
    async findByDataSource(dataSourceId: string): Promise<Result<DatasetView[], AppError>> {
        try {
            const rows = await prisma.dataset.findMany({
                where: { dataSourceId },
                include: withDataSource,
                orderBy: { name: "asc" },
            });
            return ok(rows.map(toDatasetView));
        } catch (cause) {
            logger.error("datasetRepository.findByDataSource failed", { cause, dataSourceId });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Single dataset by ID, without website scoping. Internal use only.
     * Prefer `findByIdForWebsite` in service-layer callers.
     */
    async findById(id: string): Promise<Result<DatasetView | null, AppError>> {
        try {
            const row = await prisma.dataset.findUnique({
                where: { id },
                include: withDataSource,
            });
            return ok(row ? toDatasetView(row) : null);
        } catch (cause) {
            logger.error("datasetRepository.findById failed", { cause, id });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Same lookup as `findById`, scoped to a website via the parent DataSource.
     * Returns `ok(null)` when not found OR when the dataset's source belongs
     * to a different website — same outcome intentionally (avoids leaking IDs).
     */
    async findByIdForWebsite(id: string, websiteId: string): Promise<Result<DatasetView | null, AppError>> {
        try {
            const row = await prisma.dataset.findFirst({
                where: {
                    id,
                    dataSource: { websiteId },
                },
                include: withDataSource,
            });
            return ok(row ? toDatasetView(row) : null);
        } catch (cause) {
            logger.error("datasetRepository.findByIdForWebsite failed", { cause, id, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Datasets compatible with a component's declared canonicalType, scoped to
     * a website via the parent DataSource. This is the primary query for the
     * dataset selector in the properties panel.
     *
     * Returns datasets ordered by name, with parent source info denormalised
     * for display (source name, source status).
     */
    async findCompatible(websiteId: string, canonicalType: CanonicalType): Promise<Result<DatasetView[], AppError>> {
        try {
            const rows = await prisma.dataset.findMany({
                where: {
                    canonicalType,
                    dataSource: { websiteId },
                },
                include: withDataSource,
                orderBy: { name: "asc" },
            });
            return ok(rows.map(toDatasetView));
        } catch (cause) {
            logger.error("datasetRepository.findCompatible failed", { cause, websiteId, canonicalType });
            return err(AppErrors.database(cause));
        }
    },

    async create(input: CreateDatasetInput): Promise<Result<DatasetView, AppError>> {
        try {
            const row = await prisma.dataset.create({
                data: {
                    dataSourceId: input.dataSourceId,
                    name: input.name,
                    slug: input.slug,
                    canonicalType: input.canonicalType,
                },
                include: withDataSource,
            });
            return ok(toDatasetView(row));
        } catch (cause) {
            logger.error("datasetRepository.create failed", { cause, input });
            if (isUniqueConstraintError(cause)) {
                return err(AppErrors.conflict(`Ein Datensatz mit dem Schlüssel „${input.slug}" existiert bereits in dieser Datenquelle.`));
            }
            if (isNotFoundError(cause)) {
                return err(AppErrors.notFound("Datenquelle"));
            }
            return err(AppErrors.database(cause));
        }
    },

    async update(id: string, input: UpdateDatasetInput): Promise<Result<DatasetView, AppError>> {
        try {
            const row = await prisma.dataset.update({
                where: { id },
                data: {
                    ...(input.name !== undefined && { name: input.name }),
                    ...(input.slug !== undefined && { slug: input.slug }),
                },
                include: withDataSource,
            });
            return ok(toDatasetView(row));
        } catch (cause) {
            logger.error("datasetRepository.update failed", { cause, id });
            if (isUniqueConstraintError(cause)) {
                return err(AppErrors.conflict("Ein Datensatz mit diesem Schlüssel existiert bereits in der Datenquelle."));
            }
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datensatz"));
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Persists a completed field mapping for a dataset.
     * Resets status to UNKNOWN since the mapping may change what data is valid.
     */
    async saveMapping(id: string, mapping: DatasetMapping): Promise<Result<DatasetView, AppError>> {
        try {
            const row = await prisma.dataset.update({
                where: { id },
                data: {
                    mapping: toInputJson(mapping),
                    status: "UNKNOWN",
                    lastFetchedAt: null,
                },
                include: withDataSource,
            });
            return ok(toDatasetView(row));
        } catch (cause) {
            logger.error("datasetRepository.saveMapping failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datensatz"));
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Records the outcome of a fetch attempt for this specific dataset.
     */
    async recordFetchResult(
        id: string,
        result: { status: DataSourceStatus; lastFetchedAt: Date | null }
    ): Promise<Result<DatasetView, AppError>> {
        try {
            const row = await prisma.dataset.update({
                where: { id },
                data: { status: result.status, lastFetchedAt: result.lastFetchedAt },
                include: withDataSource,
            });
            return ok(toDatasetView(row));
        } catch (cause) {
            logger.error("datasetRepository.recordFetchResult failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datensatz"));
            return err(AppErrors.database(cause));
        }
    },

    async delete(id: string): Promise<Result<void, AppError>> {
        try {
            await prisma.dataset.delete({ where: { id } });
            return ok(undefined);
        } catch (cause) {
            logger.error("datasetRepository.delete failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datensatz"));
            return err(AppErrors.database(cause));
        }
    },
};
