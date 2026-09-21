import { unstable_cache } from "next/cache";
import type { Result } from "@/lib/result/result";
import type { DataSourceError } from "@/modules/data-sources/domain/data-source-adapter";
import type { DataSourceDataset } from "@/modules/data-sources/domain/data-source-schema";

/**
 * Default revalidation window per dataset, in seconds (Phase 3.5 spec
 * §19's worked examples: "Events: 5–15 minutes... Parking: 30–120
 * seconds"). "civic" datasets (events, news, services) change on a
 * municipal-content cadence; "smartcity" datasets (parking, sensors) can
 * change every refresh, so they get a much shorter window.
 *
 * Deliberately a fixed per-dataset default rather than a per-source
 * configurable field in this phase (spec §19: "avoid unnecessary
 * complexity in the first implementation") — the natural extension point
 * is a `refreshIntervalSeconds` column on DataSource, read here instead
 * of this constant, without changing anything about how caching itself
 * works.
 *
 * A short window is used for every dataset rather than a longer one,
 * even for "civic": the window bounds how long a source outage or a
 * newly-saved mapping takes to be reflected on the public site, and both
 * matter more than shaving additional external requests once a request
 * is already this infrequent.
 */
const DEFAULT_REVALIDATE_SECONDS: Record<DataSourceDataset, number> = {
    civic: 300, // 5 minutes
    smartcity: 60, // 1 minute
};

/**
 * Wraps a REST data source fetch in Next.js's persistent cache (spec
 * §19 — "Do not request external APIs on every browser render").
 *
 * Uses `unstable_cache` rather than relying on Next's `fetch()` patching
 * directly, because the actual network call happens inside
 * `restJsonAdapter.fetch`, several layers below this call site — this
 * codebase does not have `cacheComponents` enabled (see next.config.ts),
 * so the applicable model is the "Caching and Revalidating (Previous
 * Model)" guide's `unstable_cache` section: "allows you to cache the
 * result of... async functions that don't use fetch [directly]".
 *
 * Both success and failure `Result`s are cached for the dataset's
 * window — deliberately, since:
 *  - `unstable_cache` caches whatever its wrapped function returns; there
 *    is no documented per-call opt-out for only some return values, so
 *    trying to special-case "don't cache failures" would mean relying on
 *    undocumented throw/catch behavior instead of the library's stated
 *    contract.
 *  - the revalidate windows here are already short (1–5 minutes), and
 *    every consuming provider (RestCivicDataProvider,
 *    RestSmartCityDataProvider) already falls back to mock data on any
 *    failed Result regardless of whether that failure came from cache or
 *    a fresh request — so a cached failure has the same visible effect
 *    on the public site as an uncached one: sample data, briefly.
 *  - this matches ordinary HTTP/CDN caching semantics, where an
 *    upstream's error response is itself often cached briefly rather
 *    than retried on every single request.
 *
 * Tagged with `data-source:{id}` so a future on-demand revalidation
 * (e.g. from the "Test Connection" or "Save Mapping" actions calling
 * `revalidateTag`) can force a fresh fetch without waiting out the
 * window — not wired up yet in this phase, since `revalidatePath` on the
 * settings/builder routes already covers the immediate UI-facing need
 * (spec §19's own "avoid unnecessary complexity" applies here too).
 *
 * `cacheKeyVersion` (pass the source row's `updatedAt.toISOString()`) is
 * part of the cache key, not just `dataSourceId`, so that editing a
 * source's URL, auth mode, or mapping invalidates the cache immediately
 * rather than serving a stale response — built from the OLD
 * configuration — for up to the rest of the revalidate window. The same
 * `dataSourceId` persists across an edit (upsert updates the existing
 * row rather than replacing it — see data-source-repository.ts), so
 * `dataSourceId` alone is not a sufficient cache key once the source can
 * be edited in place.
 */
export function cachedRestFetch(
    dataSourceId: string,
    dataset: DataSourceDataset,
    cacheKeyVersion: string,
    fetchRaw: () => Promise<Result<unknown, DataSourceError>>
): Promise<Result<unknown, DataSourceError>> {
    const cached = unstable_cache(fetchRaw, ["data-source-fetch", dataSourceId, cacheKeyVersion], {
        revalidate: DEFAULT_REVALIDATE_SECONDS[dataset],
        tags: [`data-source:${dataSourceId}`],
    });
    return cached();
}
