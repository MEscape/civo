import { TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import { formatChange } from "@/lib/utils/formatters";

type Trend = NonNullable<SmartCityMetric["trend"]>;

const TREND_ICON: Record<Trend, typeof TrendingUp> = { up: TrendingUp, down: TrendingDown, flat: Minus };

/**
 * A change figure: arrow plus signed value, e.g. "↗ +3,1 %". The direction is
 * written out in text, and the arrow is decorative, so screen-reader users
 * hear "Veränderung: −6,8 %" rather than a bare "6,8 %". Color is deliberately
 * neutral: nothing here knows whether up is good (rising energy use is not).
 */
export function MetricChange({ trend, changePercent, iconClassName = "size-3.5" }: { trend: Trend; changePercent: number; iconClassName?: string }) {
    const Icon = TREND_ICON[trend];
    return (
        <span className="inline-flex items-center gap-1">
            <Icon className={iconClassName} aria-hidden="true" />
            <span className="sr-only">Veränderung: </span>
            <span>{formatChange(changePercent, trend)}</span>
        </span>
    );
}
