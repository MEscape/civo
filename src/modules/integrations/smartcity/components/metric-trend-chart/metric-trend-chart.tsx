import { metricTrendChartPropsSchema } from "./metric-trend-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { MetricFreshness } from "../metric-freshness";
import { logger } from "@/lib/logger/logger";
import { TrendChartClient } from "./trend-chart-client";

/**
 * MetricTrendChart — line/area chart of a single metric's `series` over
 * time (spec: Smart City viz batch). Complements the existing bar-only
 * metricChart, which only ever compares metrics side by side at a single
 * point in time and can't show change over time at all.
 */
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function MetricTrendChart({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricTrendChartPropsSchema.safeParse(props);
    const { heading, metricId, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Entwicklung über Zeit", metricId: undefined, category: undefined , datasetId: undefined};

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricTrendChart failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} tone="muted" />;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.series && m.series.length > 0);

    if (!metric || !metric.series || metric.series.length === 0) return <WidgetState kind="empty" heading={heading} tone="muted" />;

    return (
        <Section tone="muted" className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{`${heading} · ${metric.label}`}</SectionHeading>
                <TrendChartClient data={metric.series} unit={metric.unit} />
                <MetricFreshness metrics={[metric]} />
            </Container>
        </Section>
    );
}
