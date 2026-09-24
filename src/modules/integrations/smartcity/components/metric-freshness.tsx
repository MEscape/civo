import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import { formatDate } from "@/lib/utils/formatters";

/**
 * "Stand: 31. Januar 2024 · Quelle: Stadtwerke Musterstadt" under a widget.
 *
 * Says only what the data says. A metric with no `updatedAt`/`source`
 * contributes nothing, and if nothing is known the line is omitted: a
 * missing timestamp must never read as "current". Absolute dates on
 * purpose ("vor 5 Minuten" would be wrong by the time a cached page is
 * read, and differs between server and browser).
 *
 * Uses formatDate's "long" preset, which is date-only: an `updatedAt` with a
 * time component still only shows the day. A NaN date (a malformed
 * `updatedAt`) is filtered out before formatting, since formatDate has no
 * built-in guard against printing "Invalid Date".
 */
export function MetricFreshness({ metrics }: { metrics: readonly SmartCityMetric[] }) {
    // The oldest figure is the honest "as of" for a widget mixing several.
    const oldest = metrics
        .flatMap((m) => (m.updatedAt ? [m.updatedAt] : []))
        .filter((iso) => !Number.isNaN(new Date(iso).getTime()))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    const sources = [...new Set(metrics.flatMap((m) => (m.source ? [m.source] : [])))];

    const label = oldest ? formatDate(oldest, "long") : null;
    if (!label && sources.length === 0) return null;

    return (
        <p className="mt-4 text-xs text-copy-muted">
            {label && (
                <>
                    Stand: <time dateTime={oldest}>{label}</time>
                </>
            )}
            {label && sources.length > 0 && " · "}
            {sources.length > 0 && <>Quelle: {sources.join(", ")}</>}
        </p>
    );
}
