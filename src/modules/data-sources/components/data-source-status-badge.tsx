import type { DataSourceStatus } from "@/modules/data-sources/domain/data-source-schema";

/**
 * Fixed semantic colors for connection status — not theme tokens,
 * matching the same deliberate exception alert-banner.tsx documents for
 * severity indicators: a municipality's brand palette should never make
 * "this connection is broken" ambiguous.
 */
const statusClasses: Record<DataSourceStatus, string> = {
    OK: "border-green-200 bg-green-50 text-green-900",
    ERROR: "border-red-200 bg-red-50 text-red-900",
    UNKNOWN: "border-gray-200 bg-gray-50 text-gray-700",
};

const statusLabel: Record<DataSourceStatus, string> = {
    OK: "Verbunden",
    ERROR: "Fehler",
    UNKNOWN: "Nicht getestet",
};

export function DataSourceStatusBadge({ status }: { status: DataSourceStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}
        >
            {statusLabel[status]}
        </span>
    );
}
