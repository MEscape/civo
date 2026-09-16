import { TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import { kpiGridPropsSchema } from "./kpi-grid.definition";
import { getSmartCityDataProvider } from "@/modules/integrations/smartcity/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import type { SmartCityMetric } from "@/modules/content/domain/content-types";

const trendIcon: Record<NonNullable<SmartCityMetric["trend"]>, typeof TrendingUp> = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
};

const numberFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export async function KpiGrid({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = kpiGridPropsSchema.safeParse(props);
    const { heading, columns, category } = parsed.success
        ? parsed.data
        : { heading: "Stadt in Zahlen", columns: 3 as const, category: undefined };

    const provider = await getSmartCityDataProvider(websiteId);
    const result = await provider.getMetrics({ category });

    if (!result.ok) {
        logger.error("KpiGrid failed to load metrics", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section>
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((metric) => {
                        const Trend = metric.trend ? trendIcon[metric.trend] : null;
                        return (
                            <Card key={metric.id}>
                                <CardContent className="pt-5">
                                    <p className="text-sm text-[var(--civo-color-text-muted)]">{metric.label}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="font-[family-name:var(--civo-font-heading)] text-3xl text-[var(--civo-color-primary)]">
                                            {numberFormatter.format(metric.value)}
                                        </span>
                                        {metric.unit && (
                                            <span className="text-sm text-[var(--civo-color-text-muted)]">{metric.unit}</span>
                                        )}
                                    </div>
                                    {Trend && metric.changePercent !== undefined && (
                                        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--civo-color-text-muted)]">
                                            <Trend className="h-3.5 w-3.5" aria-hidden="true" />
                                            <span>{numberFormatter.format(Math.abs(metric.changePercent))}%</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Grid>
            </Container>
        </Section>
    );
}
