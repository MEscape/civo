import { metricChartPropsSchema } from "./metric-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { MetricFreshness } from "../metric-freshness";
import { logger } from "@/lib/logger/logger";
import { MetricChartClient } from "./metric-chart-client";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function MetricChart({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricChartPropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Entwicklung", category: undefined , datasetId: undefined};

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricChart failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} tone="muted" />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} tone="muted" />;

    const data = result.data.map((metric) => ({ label: metric.label, value: metric.value }));

    return (
        <Section tone="muted" className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <MetricChartClient data={data} />
                <MetricFreshness metrics={result.data} />
            </Container>
        </Section>
    );
}
