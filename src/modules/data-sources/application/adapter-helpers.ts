import type { DataSourceAdapter, DataSourceError } from "@/modules/data-sources/domain/data-source-adapter";
import type { DataSourceKind } from "@/modules/data-sources/domain/data-source-schema";
import type { AppError } from "@/lib/errors/app-error";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";

/**
 * Resolves which adapter implementation handles a given data source kind.
 * MOCK has no adapter — served directly by mock providers.
 */
export function adapterForKind(kind: DataSourceKind): DataSourceAdapter<unknown> | null {
    return kind === "REST" ? restJsonAdapter : null;
}

export function connectionFailure(error: AppError, category: DataSourceError["category"]): DataSourceError {
    return { ...error, category };
}
