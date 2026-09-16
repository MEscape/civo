import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { dashboardGridPropsSchema } from "./dashboard-grid.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import type { SmartCityMetric } from "@/modules/content/domain/content-types";
import { TrendChartClient } from "../metric-trend-chart/trend-chart-client";
import { DonutChartClient } from "../metric-donut/donut-chart-client";

const trendIcon: Record<NonNullable<SmartCityMetric["trend"]>, typeof TrendingUp> = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
};
const numberFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/**
 * DashboardGrid — the "Smart-City-Dashboard" composite (spec: Smart City
 * viz batch). Arranges KPI cards alongside a trend chart and a donut in
 * one section, instead of an editor manually stacking kpiGrid +
 * metricTrendChart + metricDonut with matching headings/category filters
 * every time a municipality wants a dashboard-style overview page.
 * Reuses the same client chart leaves as the standalone components
 * (TrendChartClient, DonutChartClient) — no duplicated charting logic.
 */
export async function DashboardGrid({ props }: { props: Record<string, unknown> }) {
    const parsed = dashboardGridPropsSchema.safeParse(props);
    const { heading, category } = parsed.success
        ? parsed.data
        : { heading: "Smart-City-Dashboard", category: undefined };

    const provider = getSmartCityDataProvider();
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("DashboardGrid failed to load metrics", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    const trendMetric = result.data.find((m) => m.series && m.series.length > 0);
    const donutMetric = result.data.find((m) => m.breakdown && m.breakdown.length > 0);

    return (
        <Section>
            <Container>
                <SectionHeading>{heading}</SectionHeading>

                <Grid columns={result.data.length >= 4 ? 4 : ((result.data.length || 1) as 1 | 2 | 3 | 4)}>
                    {result.data.map((metric) => {
                        const Trend = metric.trend ? trendIcon[metric.trend] : null;
                        return (
                            <Card key={metric.id}>
                                <CardContent className="pt-5">
                                    <p className="text-sm text-[var(--civo-color-text-muted)]">{metric.label}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="font-[family-name:var(--civo-font-heading)] text-2xl text-[var(--civo-color-primary)]">
                                            {numberFormatter.format(metric.value)}
                                        </span>
                                        {metric.unit && (
                                            <span className="text-xs text-[var(--civo-color-text-muted)]">{metric.unit}</span>
                                        )}
                                    </div>
                                    {Trend && metric.changePercent !== undefined && (
                                        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--civo-color-text-muted)]">
                                            <Trend className="h-3 w-3" aria-hidden="true" />
                                            <span>{numberFormatter.format(Math.abs(metric.changePercent))}%</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Grid>

                {(trendMetric || donutMetric) && (
                    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                        {trendMetric?.series && (
                            <Card>
                                <CardContent className="pt-5">
                                    <p className="mb-3 text-sm font-medium text-[var(--civo-color-text)]">
                                        {trendMetric.label} · Verlauf
                                    </p>
                                    <TrendChartClient data={trendMetric.series} unit={trendMetric.unit} />
                                </CardContent>
                            </Card>
                        )}
                        {donutMetric?.breakdown && (
                            <Card>
                                <CardContent className="pt-5">
                                    <p className="mb-3 text-sm font-medium text-[var(--civo-color-text)]">
                                        {donutMetric.label} · Verteilung
                                    </p>
                                    <DonutChartClient data={donutMetric.breakdown} />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </Container>
        </Section>
    );
}
