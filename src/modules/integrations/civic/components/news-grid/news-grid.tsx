import { newsGridPropsSchema } from "./news-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";

/**
 * NewsGrid — a canonical example of the "components never see the
 * external schema" principle (spec §4). This component only knows about
 * `NewsItem` (src/domain/content/content-types.ts) and the
 * MunicipalityDataProvider interface. Whether that data originated from
 * the mock provider, a future REST adapter, or a database query is
 * invisible here.
 */
export async function NewsGrid({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = newsGridPropsSchema.safeParse(props);
    const { heading, columns, limit, category } = parsed.success
        ? parsed.data
        : { heading: "Aktuelles", columns: 3 as const, limit: 6, category: undefined };

    const provider = await getCivicDataProvider(websiteId);
    const result = await provider.getNews({ limit, category });

    if (!result.ok) {
        logger.error("NewsGrid failed to load news", { error: result.error });
        return (
            <Section>
                <Container>
                    <SectionHeading>{heading}</SectionHeading>
                    <p className="text-sm text-[var(--civo-color-text-muted)]">
                        Neuigkeiten konnten derzeit nicht geladen werden.
                    </p>
                </Container>
            </Section>
        );
    }

    if (result.data.length === 0) return null;

    return (
        <Section>
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
                                    <p className="text-xs font-medium text-[var(--civo-color-accent)]">
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
