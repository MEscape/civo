import { metricDonutPropsSchema } from "./metric-donut.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { MetricFreshness } from "../metric-freshness";
import { logger } from "@/lib/logger/logger";
import { DonutChartClient } from "./donut-chart-client";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * MetricDonut — composition/share chart (spec: Smart City viz batch),
 * e.g. energy mix or mobility modal split, reading a metric's
 * `breakdown` segments. Picks the first metric with a breakdown when
 * no explicit metricId is given, matching metricTrendChart's fallback
 * pattern for consistency.
 */
export async function MetricDonut({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricDonutPropsSchema.safeParse(props);
    const { heading, metricId, datasetId } = parsed.success ? parsed.data : { heading: "Verteilung", metricId: undefined, datasetId: undefined };

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({});

    if (!result.ok) {
        logger.error("MetricDonut failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.breakdown && m.breakdown.length > 0);

    if (!metric || !metric.breakdown || metric.breakdown.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container className="max-w-2xl">
                <SectionHeading>{`${heading} · ${metric.label}`}</SectionHeading>
                <DonutChartClient data={metric.breakdown} />
                <MetricFreshness metrics={[metric]} />
            </Container>
        </Section>
    );
}
