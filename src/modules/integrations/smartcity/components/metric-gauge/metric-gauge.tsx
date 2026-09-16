import { metricGaugePropsSchema } from "./metric-gauge.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { GaugeChartClient } from "./gauge-chart-client";

const numberFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export async function MetricGauge({ props }: { props: Record<string, unknown> }) {
    const parsed = metricGaugePropsSchema.safeParse(props);
    const { heading, metricId } = parsed.success ? parsed.data : { heading: undefined, metricId: undefined };

    const provider = getSmartCityDataProvider();
    const result = await provider.getMetrics({});

    if (!result.ok) {
        logger.error("MetricGauge failed to load metrics", { error: result.error });
        return null;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.target !== undefined);

    if (!metric || metric.target === undefined || metric.target === 0) return null;

    const percent = (metric.value / metric.target) * 100;

    return (
        <Section tone="muted">
            <Container className="flex flex-col items-center text-center">
                <SectionHeading className="mb-2">{heading ?? metric.label}</SectionHeading>
                <GaugeChartClient percent={percent} />
                <p className="mt-2 text-sm text-[var(--civo-color-text-muted)]">
                    {numberFormatter.format(metric.value)}
                    {metric.unit ? ` ${metric.unit}` : ""} von {numberFormatter.format(metric.target)}
                    {metric.unit ? ` ${metric.unit}` : ""} Ziel
                </p>
            </Container>
        </Section>
    );
}
