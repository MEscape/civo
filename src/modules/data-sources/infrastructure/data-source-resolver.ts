import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { logger } from "@/lib/logger/logger";
import type { DataSourceDataset } from "@/modules/data-sources/domain/data-source-schema";
import type { DataSourceRow } from "@/modules/data-sources/infrastructure/data-source-repository";

/**
 * Resolves which `DataSourceKind` a website has configured for a given
 * dataset (civic or smart-city) — Phase 3 spec §22 ("a website can
 * configure where its canonical data comes from").
 *
 * This is the ONLY thing this module decides. It deliberately does NOT
 * construct provider instances itself (that stays in each integration
 * module's own `infrastructure/adapters/index.ts` — see
 * civic/infrastructure/adapters/index.ts) so this module never needs to
 * import every concrete provider class, and each integration module
 * keeps owning its own provider wiring, matching the existing
 * civic/smartcity module boundary rather than centralizing it here.
 *
 * When a website has no configured row for a dataset (the common case
 * for every website created so far, since this used to not exist at
 * all), this resolves to "MOCK". A row whose kind has no adapter
 * implementation yet (GRAPHQL — Phase 3.5 scopes building that adapter
 * OUT of this phase; REST now has one, see
 * civic/infrastructure/adapters/rest-civic-provider.ts) also falls back
 * to "MOCK" and logs why, rather than failing the whole page (spec §50 —
 * a data provider failure mode should degrade, never take down an
 * unrelated part of the site).
 */
export async function resolveDataSourceKind(
    websiteId: string | undefined,
    dataset: DataSourceDataset
): Promise<{ kind: "MOCK"; row: DataSourceRow | null } | { kind: "REST" | "GRAPHQL"; row: DataSourceRow }> {
    if (!websiteId) {
        // No website context (e.g. a code path that renders components
        // outside any website, if one ever exists) — mock is the only
        // sensible default here, same as "no row configured".
        return { kind: "MOCK", row: null };
    }

    const result = await dataSourceRepository.findByWebsiteAndDataset(websiteId, dataset);
    if (!result.ok) {
        logger.error("resolveDataSourceKind: failed to load configured data source, falling back to mock", {
            websiteId,
            dataset,
            cause: result.error,
        });
        return { kind: "MOCK", row: null };
    }

    const row = result.data;
    if (!row) {
        return { kind: "MOCK", row: null };
    }

    if (row.kind === "GRAPHQL") {
        // No GraphQL adapter implemented yet (kept explicit, not folded
        // into a `default` branch, so adding one later is a compile-error
        // reminder here rather than a silent gap).
        logger.warn("resolveDataSourceKind: configured kind has no adapter implementation yet, falling back to mock", {
            websiteId,
            dataset,
            configuredKind: row.kind,
        });
        return { kind: "MOCK", row };
    }

    return { kind: row.kind, row };
}
