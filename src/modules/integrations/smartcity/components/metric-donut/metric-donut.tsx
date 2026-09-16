import { metricDonutPropsSchema } from "./metric-donut.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { DonutChartClient } from "./donut-chart-client";

/**
 * MetricDonut — composition/share chart (spec: Smart City viz batch),
 * e.g. energy mix or mobility modal split, reading a metric's
 * `breakdown` segments. Picks the first metric with a breakdown when
 * no explicit metricId is given, matching metricTrendChart's fallback
 * pattern for consistency.
 */
export async function MetricDonut({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = metricDonutPropsSchema.safeParse(props);
    const { heading, metricId } = parsed.success ? parsed.data : { heading: "Verteilung", metricId: undefined };

    const provider = await getSmartCityDataProvider(websiteId);
    const result = await provider.getMetrics({});

    if (!result.ok) {
        logger.error("MetricDonut failed to load metrics", { error: result.error });
        return null;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.breakdown && m.breakdown.length > 0);

    if (!metric || !metric.breakdown || metric.breakdown.length === 0) return null;

    return (
        <Section>
            <Container className="max-w-2xl">
                <SectionHeading>{`${heading} · ${metric.label}`}</SectionHeading>
                <DonutChartClient data={metric.breakdown} />
            </Container>
        </Section>
    );
}
