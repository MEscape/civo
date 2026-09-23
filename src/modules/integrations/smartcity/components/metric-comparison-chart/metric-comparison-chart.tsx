import { metricComparisonChartPropsSchema } from "./metric-comparison-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { ComparisonChartClient } from "./comparison-chart-client";

export async function MetricComparisonChart({ props }: { props: Record<string, unknown>}) {
    const parsed = metricComparisonChartPropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Vergleich", category: undefined , datasetId: undefined};

    const provider = await getSmartCityDataProvider(datasetId);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricComparisonChart failed to load metrics", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    const data = result.data.map((metric) => ({
        label: metric.label,
        value: metric.value,
        target: metric.target,
    }));

    return (
        <Section className="relative">
            
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <ComparisonChartClient data={data} />
            </Container>
        </Section>
    );
}
