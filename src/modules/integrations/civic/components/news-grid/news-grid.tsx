import { newsGridPropsSchema } from "./news-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * NewsGrid — a canonical example of the "components never see the
 * external schema" principle (spec §4). This component only knows about
 * `NewsItem` (src/modules/content/domain/civic-types.ts) and the
 * MunicipalityDataProvider interface. Whether that data originated from
 * the mock provider, a future REST adapter, or a database query is
 * invisible here.
 */
export async function NewsGrid({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = newsGridPropsSchema.safeParse(props);
    const { heading, columns, limit, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Aktuelles", columns: 3 as const, limit: 6, category: undefined, datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getNews({ limit, category });

    if (!result.ok) {
        logger.error("NewsGrid failed to load news", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }

    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                            {item.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.imageUrl} alt="" className="h-40 w-full object-cover" />
                            )}
                            <CardHeader>
                                {item.category && (
                                    <p className="text-xs font-medium text-accent-copy">
                                        {item.category}
                                    </p>
                                )}
                                <CardTitle>{item.title}</CardTitle>
                                {item.excerpt && <CardDescription>{item.excerpt}</CardDescription>}
                            </CardHeader>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
