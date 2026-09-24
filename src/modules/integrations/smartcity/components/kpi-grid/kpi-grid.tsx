import { kpiGridPropsSchema } from "./kpi-grid.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { logger } from "@/lib/logger/logger";
import { MetricCard } from "../metric-card";
import { MetricFreshness } from "../metric-freshness";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function KpiGrid({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = kpiGridPropsSchema.safeParse(props);
    const { heading, columns, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Stadt in Zahlen", columns: 3 as const, category: undefined , datasetId: undefined};

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("KpiGrid failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((metric) => (
                        <MetricCard key={metric.id} metric={metric} />
                    ))}
                </Grid>
                <MetricFreshness metrics={result.data} />
            </Container>
        </Section>
    );
}
