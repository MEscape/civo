import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { isNotFoundError } from "@/lib/db/prisma-errors";
import { Prisma } from "@prisma/client";

import { toDataSourceView, type DataSourceView, type DataSourceKind, type DataSourceStatus } from "@/modules/data-sources/domain/data-source-schema";
import { toDatasetView } from "@/modules/data-sources/domain/dataset-schema";

/**
 * `Prisma.InputJsonValue` is an infrastructure/Prisma concept. Every
 * method here accepts plain domain values and performs the cast internally,
 * so nothing above this file needs to know Prisma's JSON-input type exists.
 */
function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

/**
 * Repository layer: the ONLY place in the application allowed to call
 * `prisma.dataSource` directly.
 *
 * A DataSource is a connection to an external system. It has no "dataset"
 * type constraint — a website may have any number of sources of any kind.
 * Datasets (and their field mappings) live in the Dataset model; see
 * dataset-repository.ts.
 */
export const dataSourceRepository = {
    async findByWebsite(websiteId: string): Promise<Result<DataSourceView[], AppError>> {
        try {
            const rows = await prisma.dataSource.findMany({
                where: { websiteId },
                orderBy: { createdAt: "asc" },
            });
            return ok(rows.map((row) => toDataSourceView(row)));
        } catch (cause) {
            logger.error("dataSourceRepository.findByWebsite failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async findByWebsiteWithDatasets(websiteId: string): Promise<Result<DataSourceView[], AppError>> {
        try {
            const rows = await prisma.dataSource.findMany({
                where: { websiteId },
                include: {
                    datasets: {
                        orderBy: { name: "asc" },
                    },
                },
                orderBy: { createdAt: "asc" },
            });
            return ok(rows.map((row) => {
                const { datasets, ...source } = row;
                return toDataSourceView(
                    source,
                    datasets.map((d) => toDatasetView({ ...d, dataSource: source }))
                );
            }));
        } catch (cause) {
            logger.error("dataSourceRepository.findByWebsiteWithDatasets failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async findById(id: string): Promise<Result<DataSourceView | null, AppError>> {
        try {
            const row = await prisma.dataSource.findUnique({ where: { id } });
            return ok(row ? toDataSourceView(row) : null);
        } catch (cause) {
            logger.error("dataSourceRepository.findById failed", { cause, id });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Same lookup as `findById`, scoped to a website in the same round trip.
     * Returns `ok(null)` when the row does not exist OR belongs to a different
     * website — deliberately the same outcome so a caller cannot distinguish
     * "not found" from "not yours" from the result alone.
     */
    async findByIdForWebsite(id: string, websiteId: string): Promise<Result<DataSourceView | null, AppError>> {
        const result = await this.findById(id);
        if (!result.ok) return result;
        if (result.data === null || result.data.websiteId !== websiteId) return ok(null);
        return ok(result.data);
    },

    /**
     * Creates a new DataSource for a website. No unique constraint on name —
     * a website may have multiple sources with different purposes.
     */
    async create(input: {
        websiteId: string;
        name: string;
        kind: DataSourceKind;
        config: Record<string, unknown>;
    }): Promise<Result<DataSourceView, AppError>> {
        try {
            const row = await prisma.dataSource.create({
                data: {
                    websiteId: input.websiteId,
                    name: input.name,
                    kind: input.kind,
                    config: toInputJson(input.config),
                },
            });
            return ok(toDataSourceView(row));
        } catch (cause) {
            logger.error("dataSourceRepository.create failed", { cause, input });
            if (isNotFoundError(cause)) {
                return err(AppErrors.notFound("Website"));
            }
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Updates a DataSource's name, kind, and config.
     * Changing kind or config invalidates any prior dataset mappings and
     * test-connection status — callers should reset affected datasets.
     */
    async update(id: string, input: {
        name?: string;
        kind?: DataSourceKind;
        config?: Record<string, unknown>;
    }): Promise<Result<DataSourceView, AppError>> {
        try {
            const row = await prisma.dataSource.update({
                where: { id },
                data: {
                    ...(input.name !== undefined && { name: input.name }),
                    ...(input.kind !== undefined && { kind: input.kind }),
                    ...(input.config !== undefined && { config: toInputJson(input.config) }),
                    status: "UNKNOWN",
                    lastCheckedAt: null,
                    lastError: null,
                },
            });
            return ok(toDataSourceView(row));
        } catch (cause) {
            logger.error("dataSourceRepository.update failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datenquelle"));
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Records the outcome of a test-connection or live-fetch attempt.
     * `lastError` is a short, user-safe diagnostic string — never a raw
     * exception message or stack trace.
     */
    async recordTestResult(
        id: string,
        result: { status: DataSourceStatus; lastError: string | null }
    ): Promise<Result<DataSourceView, AppError>> {
        try {
            const row = await prisma.dataSource.update({
                where: { id },
                data: { status: result.status, lastError: result.lastError, lastCheckedAt: new Date() },
            });
            return ok(toDataSourceView(row));
        } catch (cause) {
            logger.error("dataSourceRepository.recordTestResult failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datenquelle"));
            return err(AppErrors.database(cause));
        }
    },

    async delete(id: string): Promise<Result<void, AppError>> {
        try {
            await prisma.dataSource.delete({ where: { id } });
            return ok(undefined);
        } catch (cause) {
            logger.error("dataSourceRepository.delete failed", { cause, id });
            if (isNotFoundError(cause)) return err(AppErrors.notFound("Datenquelle"));
            return err(AppErrors.database(cause));
        }
    },
};
