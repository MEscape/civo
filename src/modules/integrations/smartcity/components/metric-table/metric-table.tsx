import { TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import { metricTablePropsSchema } from "./metric-table.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { logger } from "@/lib/logger/logger";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";
import { formatNumber } from "@/lib/utils/formatters";

const trendIcon: Record<NonNullable<SmartCityMetric["trend"]>, typeof TrendingUp> = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
};

/**
 * MetricTable — tabular view of KPIs (spec: Smart City viz batch), for
 * cases where a chart isn't the right shape (e.g. many metrics at once,
 * or a data-dense overview page) but the metric cards in kpiGrid are too
 * sparse. Uses the shadcn-style Table primitive rather than a bespoke
 * grid of divs, per spec §27's guidance to use library primitives over
 * rebuilding them.
 */
export async function MetricTable({ props }: { props: Record<string, unknown>}) {
    const parsed = metricTablePropsSchema.safeParse(props);
    const { heading, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Kennzahlen im Überblick", category: undefined , datasetId: undefined};

    const provider = await getSmartCityDataProvider(datasetId);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("MetricTable failed to load metrics", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section>
            
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kennzahl</TableHead>
                            <TableHead>Wert</TableHead>
                            <TableHead>Veränderung</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {result.data.map((metric) => {
                            const Trend = metric.trend ? trendIcon[metric.trend] : null;
                            return (
                                <TableRow key={metric.id}>
                                    <TableCell>{metric.label}</TableCell>
                                    <TableCell>
                                        {formatNumber(metric.value)}
                                        {metric.unit ? ` ${metric.unit}` : ""}
                                    </TableCell>
                                    <TableCell>
                                        {Trend && metric.changePercent !== undefined ? (
                                            <span className="inline-flex items-center gap-1 text-[var(--civo-color-text-muted)]">
                                                <Trend className="h-3.5 w-3.5" aria-hidden="true" />
                                                {formatNumber(Math.abs(metric.changePercent))}%
                                            </span>
                                        ) : (
                                            "–"
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Container>
        </Section>
    );
}
