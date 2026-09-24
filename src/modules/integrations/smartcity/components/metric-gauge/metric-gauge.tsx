import { metricGaugePropsSchema } from "./metric-gauge.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { MetricFreshness } from "../metric-freshness";
import { logger } from "@/lib/logger/logger";
import { GaugeChartClient } from "./gauge-chart-client";
import {formatNumber} from "@/lib/utils/formatters";

import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function MetricGauge({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricGaugePropsSchema.safeParse(props);
    const { heading, metricId, datasetId } = parsed.success ? parsed.data : { heading: undefined, metricId: undefined , datasetId: undefined};
    // The heading is optional and normally falls back to the metric's own label,
    // which does not exist when there is no data. The fallback state still has to say what it is.
    const stateHeading = heading ?? "Zielerreichung";

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({});

    if (!result.ok) {
        logger.error("MetricGauge failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={stateHeading} tone="muted" />;
    }

    const metric = metricId
        ? result.data.find((m) => m.id === metricId)
        : result.data.find((m) => m.target !== undefined);

    if (!metric || metric.target === undefined || metric.target === 0) return <WidgetState kind="empty" heading={stateHeading} tone="muted" />;

    const percent = (metric.value / metric.target) * 100;

    return (
        <Section tone="muted" className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container className="flex flex-col items-center text-center">
                <SectionHeading className="mb-2">{heading ?? metric.label}</SectionHeading>
                <GaugeChartClient percent={percent} />
                <p className="mt-2 text-sm text-copy-muted">
                    {formatNumber(metric.value)}
                    {metric.unit ? ` ${metric.unit}` : ""} von {formatNumber(metric.target)}
                    {metric.unit ? ` ${metric.unit}` : ""} Ziel
                </p>
                <MetricFreshness metrics={[metric]} />
            </Container>
        </Section>
    );
}
