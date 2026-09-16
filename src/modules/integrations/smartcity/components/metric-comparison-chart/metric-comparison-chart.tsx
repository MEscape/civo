import { metricComparisonChartPropsSchema } from "./metric-comparison-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { ComparisonChartClient } from "./comparison-chart-client";

export async function MetricComparisonChart({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = metricComparisonChartPropsSchema.safeParse(props);
    const { heading, category } = parsed.success
        ? parsed.data
        : { heading: "Vergleich", category: undefined };

    const provider = await getSmartCityDataProvider(websiteId);
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
        <Section>
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <ComparisonChartClient data={data} />
            </Container>
        </Section>
    );
}
