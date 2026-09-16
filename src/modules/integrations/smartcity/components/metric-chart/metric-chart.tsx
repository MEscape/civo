import { metricChartPropsSchema } from "./metric-chart.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { MetricChartClient } from "./metric-chart-client";

export async function MetricChart({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = metricChartPropsSchema.safeParse(props);
    const { heading, category } = parsed.success
        ? parsed.data
        : { heading: "Entwicklung", category: undefined };

    const provider = await getSmartCityDataProvider(websiteId);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricChart failed to load metrics", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    const data = result.data.map((metric) => ({ label: metric.label, value: metric.value }));

    return (
        <Section tone="muted">
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <MetricChartClient data={data} />
            </Container>
        </Section>
    );
}
