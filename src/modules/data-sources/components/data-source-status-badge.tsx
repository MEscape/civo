import type { DataSourceStatus } from "@/modules/data-sources/domain/data-source-schema";
import { Badge } from "@/components/ui/badge";

/**
 * Fixed semantic colors for connection status — not theme tokens,
 * matching the same deliberate exception alert-banner.tsx documents for
 * severity indicators: a municipality's brand palette should never make
 * "this connection is broken" ambiguous.
 */
const statusVariants: Record<DataSourceStatus, "success" | "danger" | "muted"> = {
    OK: "success",
    ERROR: "danger",
    UNKNOWN: "muted",
};

const statusLabel: Record<DataSourceStatus, string> = {
    OK: "Verbunden",
    ERROR: "Fehler",
    UNKNOWN: "Nicht getestet",
};

export function DataSourceStatusBadge({ status }: { status: DataSourceStatus }) {
    return (
        <Badge variant={statusVariants[status]}>
            {statusLabel[status]}
        </Badge>
    );
}
