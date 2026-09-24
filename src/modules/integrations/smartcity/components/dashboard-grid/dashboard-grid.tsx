import { dashboardGridPropsSchema } from "./dashboard-grid.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { MetricCard } from "../metric-card";
import { MetricFreshness } from "../metric-freshness";
import { TrendChartClient } from "../metric-trend-chart/trend-chart-client";
import { DonutChartClient } from "../metric-donut/donut-chart-client";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * DashboardGrid — the "Smart-City-Dashboard" composite (spec: Smart City
 * viz batch). Arranges KPI cards alongside a trend chart and a donut in
 * one section, instead of an editor manually stacking kpiGrid +
 * metricTrendChart + metricDonut with matching headings/category filters
 * every time a municipality wants a dashboard-style overview page.
 * Reuses the same client chart leaves as the standalone components
 * (TrendChartClient, DonutChartClient) — no duplicated charting logic.
 */
export async function DashboardGrid({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = dashboardGridPropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Smart-City-Dashboard", category: undefined, datasetId: undefined };

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("DashboardGrid failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    const trendMetric = result.data.find((m) => m.series && m.series.length > 0);
    const donutMetric = result.data.find((m) => m.breakdown && m.breakdown.length > 0);

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>

                <Grid columns={result.data.length >= 4 ? 4 : ((result.data.length || 1) as 1 | 2 | 3 | 4)}>
                    {result.data.map((metric) => (
                        <MetricCard key={metric.id} metric={metric} size="md" />
                    ))}
                </Grid>

                {(trendMetric || donutMetric) && (
                    <div className="mt-8 grid grid-cols-1 gap-8 @5xl:grid-cols-2">
                        {trendMetric?.series && (
                            <Card>
                                <CardContent className="pt-5">
                                    <p className="mb-3 text-sm font-medium text-copy">
                                        {trendMetric.label} · Verlauf
                                    </p>
                                    <TrendChartClient data={trendMetric.series} unit={trendMetric.unit} />
                                </CardContent>
                            </Card>
                        )}
                        {donutMetric?.breakdown && (
                            <Card>
                                <CardContent className="pt-5">
                                    <p className="mb-3 text-sm font-medium text-copy">
                                        {donutMetric.label} · Verteilung
                                    </p>
                                    <DonutChartClient data={donutMetric.breakdown} />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                <MetricFreshness metrics={result.data} />
            </Container>
        </Section>
    );
}
