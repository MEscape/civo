import { metricComparisonChartPropsSchema } from "./metric-comparison-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { MetricFreshness } from "../metric-freshness";
import { logger } from "@/lib/logger/logger";
import { ComparisonChartClient } from "./comparison-chart-client";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function MetricComparisonChart({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricComparisonChartPropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Vergleich", category: undefined, datasetId: undefined };

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricComparisonChart failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    const data = result.data.map((metric) => ({
        label: metric.label,
        value: metric.value,
        target: metric.target,
    }));

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <ComparisonChartClient data={data} />
                <MetricFreshness metrics={result.data} />
            </Container>
        </Section>
    );
}
