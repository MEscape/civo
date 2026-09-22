import { unstable_cache } from "next/cache";
import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";
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
 */
const DEFAULT_REVALIDATE_SECONDS: Record<DataSourceDataset, number> = {
    civic: 300, // 5 minutes
    smartcity: 60, // 1 minute
};

/**
 * A JSON-serializable stand-in for a `DataSourceError`, used to
 * reconstruct the error after it crosses `unstable_cache`'s cache
 * boundary (see the throw/catch rationale below). Deliberately narrow —
 * only what the caller needs to rebuild a `DataSourceError`.
 */
type SerializedFailure = {
    __dataSourceFetchFailure: true;
    error: DataSourceError;
};

function isSerializedFailure(value: unknown): value is SerializedFailure {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as { __dataSourceFetchFailure?: true }).__dataSourceFetchFailure === true
    );
}

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
 * Only SUCCESSFUL results are cached. `unstable_cache` does not document
 * a way to opt individual return values out of caching, but it does not
 * cache a thrown error either — a rejected call is simply not stored. So
 * the wrapped function here throws the failure instead of returning it,
 * and `cachedRestFetch` catches it back into a `Result` on the way out.
 * This means:
 *  - a transient outage is retried on the very next request rather than
 *    being remembered as a failure for the rest of the revalidate window,
 *    which matters most for "civic" sources with a 5-minute window;
 *  - a genuinely persistent outage still costs one real request per
 *    incoming render during the outage, which is the same trade every
 *    uncached external call makes — acceptable here because every
 *    consuming provider (RestCivicDataProvider, RestSmartCityDataProvider)
 *    already falls back to mock data on a failed Result, so a slower
 *    failure path is not user-visible, only slightly more expensive.
 *
 * Tagged with `data-source:{id}` so a future on-demand revalidation
 * (e.g. from the "Test Connection" or "Save Mapping" actions calling
 * `revalidateTag`) can force a fresh fetch without waiting out the
 * window — not wired up yet in this phase, since `revalidatePath` on the
 * settings/builder routes already covers the immediate UI-facing need.
 *
 * `cacheKeyVersion` is part of the cache key, not just `dataSourceId`, so
 * that editing a source's URL, auth mode, or mapping invalidates the
 * cache immediately rather than serving a stale response for up to the
 * rest of the revalidate window. The same `dataSourceId` persists across
 * an edit (upsert updates the existing row rather than replacing it), so
 * `dataSourceId` alone is not a sufficient cache key once the source can
 * be edited in place.
 *
 * Pass `sourceCacheVersion(row)` (domain/source-cache-version.ts) for
 * `cacheKeyVersion`, NOT `row.updatedAt`. `updatedAt` also changes on
 * every "Test Connection" click (it only writes `status`/`lastCheckedAt`),
 * which would otherwise bust the cache on every test rather than only
 * when the fetched data could actually be different.
 */
export function cachedRestFetch(
    dataSourceId: string,
    dataset: DataSourceDataset,
    cacheKeyVersion: string,
    fetchRaw: () => Promise<Result<unknown, DataSourceError>>
): Promise<Result<unknown, DataSourceError>> {
    const cached = unstable_cache(
        async (): Promise<unknown> => {
            const result = await fetchRaw();

            if (result.ok) return result.data;

            // Thrown, not returned: see the function-level comment for why
            // this is what keeps a failure out of the cache.
            const failure: SerializedFailure = { __dataSourceFetchFailure: true, error: result.error };

            throw failure;
        },
        ["data-source-fetch", dataSourceId, cacheKeyVersion],
        {
            revalidate: DEFAULT_REVALIDATE_SECONDS[dataset],
            tags: [`data-source:${dataSourceId}`],
        }
    );

    return cached().then(
        (data) => ok(data),
        (thrown: unknown) => {
            if (isSerializedFailure(thrown)) return err(thrown.error);

            // A thrown value that is not our own serialized failure is a
            // genuine unexpected error (e.g. unstable_cache's own plumbing) —
            // surfaced as a connection failure rather than swallowed, since
            // the caller only ever expects a Result back from this function.
            return err({
                code: "EXTERNAL_API_ERROR",
                message: "Die Datenquelle konnte nicht erreicht werden.",
                category: "CONNECTION_FAILED",
            });
        }
    );
}
