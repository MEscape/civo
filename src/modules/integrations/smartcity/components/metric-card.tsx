import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import { formatNumber } from "@/lib/utils/formatters";
import { MetricChange } from "./metric-change";

const SIZE = {
    md: { value: "text-2xl", icon: "size-3" },
    lg: { value: "text-3xl", icon: "size-3.5" },
} as const;

/**
 * One headline figure: label, value, unit and change. The single place a KPI
 * is drawn, shared by the KPI grid and the dashboard so they cannot drift.
 * How the change itself is written is MetricChange's job.
 */
export function MetricCard({ metric, size = "lg" }: { metric: SmartCityMetric; size?: keyof typeof SIZE }) {
    return (
        <Card>
            <CardContent className="pt-5">
                <p className="text-sm text-copy-muted">{metric.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className={cn("font-heading text-primary-copy", SIZE[size].value)}>{formatNumber(metric.value)}</span>
                    {metric.unit && <span className="text-sm text-copy-muted">{metric.unit}</span>}
                </div>
                {metric.trend && metric.changePercent !== undefined && (
                    <p className="mt-2 text-xs text-copy-muted">
                        <MetricChange trend={metric.trend} changePercent={metric.changePercent} iconClassName={SIZE[size].icon} />
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
