import { metricTrendChartPropsSchema } from "./metric-trend-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { TrendChartClient } from "./trend-chart-client";

/**
 * MetricTrendChart — line/area chart of a single metric's `series` over
 * time (spec: Smart City viz batch). Complements the existing bar-only
 * metricChart, which only ever compares metrics side by side at a single
 * point in time and can't show change over time at all.
 */
export async function MetricTrendChart({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = metricTrendChartPropsSchema.safeParse(props);
    const { heading, metricId, category } = parsed.success
        ? parsed.data
        : { heading: "Entwicklung über Zeit", metricId: undefined, category: undefined };

    const provider = await getSmartCityDataProvider(websiteId);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricTrendChart failed to load metrics", { error: result.error });
        return null;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.series && m.series.length > 0);

    if (!metric || !metric.series || metric.series.length === 0) return null;

    return (
        <Section tone="muted">
            <Container>
                <SectionHeading>{`${heading} · ${metric.label}`}</SectionHeading>
                <TrendChartClient data={metric.series} unit={metric.unit} />
            </Container>
        </Section>
    );
}
