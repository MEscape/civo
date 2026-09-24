import { metricTablePropsSchema } from "./metric-table.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { logger } from "@/lib/logger/logger";
import { MetricChange } from "../metric-change";
import { MetricFreshness } from "../metric-freshness";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";
import { formatNumber } from "@/lib/utils/formatters";

/**
 * MetricTable — tabular view of KPIs (spec: Smart City viz batch), for
 * cases where a chart isn't the right shape (e.g. many metrics at once,
 * or a data-dense overview page) but the metric cards in kpiGrid are too
 * sparse. Uses the shadcn-style Table primitive rather than a bespoke
 * grid of divs, per spec §27's guidance to use library primitives over
 * rebuilding them.
 */
export async function MetricTable({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = metricTablePropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Kennzahlen im Überblick", category: undefined, datasetId: undefined };

    const provider = await getSmartCityDataProvider(datasetId, editMode);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricTable failed to load metrics", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Table label={heading}>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kennzahl</TableHead>
                            <TableHead>Wert</TableHead>
                            <TableHead>Veränderung</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {result.data.map((metric) => (
                            <TableRow key={metric.id}>
                                <TableCell>{metric.label}</TableCell>
                                <TableCell>
                                    {formatNumber(metric.value)}
                                    {metric.unit ? ` ${metric.unit}` : ""}
                                </TableCell>
                                <TableCell className="text-copy-muted">
                                    {metric.trend && metric.changePercent !== undefined ? (
                                        <MetricChange trend={metric.trend} changePercent={metric.changePercent} />
                                    ) : (
                                        <>
                                            <span aria-hidden="true">–</span>
                                            <span className="sr-only">keine Angabe</span>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <MetricFreshness metrics={result.data} />
            </Container>
        </Section>
    );
}
