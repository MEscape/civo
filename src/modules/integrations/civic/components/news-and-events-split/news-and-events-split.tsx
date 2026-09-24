import { newsAndEventsSplitPropsSchema } from "./news-and-events-split.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { formatDate } from "@/lib/utils/formatters";

/**
 * NewsAndEventsSplit — the extremely common municipal-homepage pattern
 * of "Aktuelles" and "Termine" side by side under one heading. Saves an
 * editor from manually placing two separate grids + matching headings
 * every time (spec: "richer composites" over generic building blocks).
 * Internally still just calls the same provider methods newsGrid/
 * eventsGrid use — no new data-fetching logic, just a different layout.
 */
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function NewsAndEventsSplit({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = newsAndEventsSplitPropsSchema.safeParse(props);
    const { heading, newsLimit, eventsLimit, eventsDatasetId, newsDatasetId } = parsed.success
        ? parsed.data
        : { heading: "Aktuelles & Termine", newsLimit: 4, eventsLimit: 4, eventsDatasetId: undefined, newsDatasetId: undefined };

    const newsProvider = await getCivicDataProvider(newsDatasetId, editMode);
    const eventsProvider = await getCivicDataProvider(eventsDatasetId, editMode);
    // Fetch both in parallel
    const [newsResult, eventsResult] = await Promise.all([
        newsProvider.getNews({ limit: newsLimit }),
        eventsProvider.getEvents({ limit: eventsLimit }),
    ]);

    if (!newsResult.ok || !eventsResult.ok) {
        if (!newsResult.ok) logger.error("NewsAndEventsSplit failed to load news", { error: newsResult.error });
        if (!eventsResult.ok) logger.error("NewsAndEventsSplit failed to load events", { error: eventsResult.error });
    }

    const news = newsResult.ok ? newsResult.data : [];
    const events = eventsResult.ok ? eventsResult.data : [];

    // One feed down but the other loaded: keep showing what we have. Nothing to
    // show: an empty list is only "empty" if BOTH requests succeeded; if either
    // failed we cannot know the other is really empty, so say it failed.
    if (news.length === 0 && events.length === 0) {
        const failed = !newsResult.ok || !eventsResult.ok;
        return <WidgetState kind={failed ? "error" : "empty"} heading={heading} />;
    }

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={newsDatasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <div className="grid grid-cols-1 gap-10 @5xl:grid-cols-2">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">
                            Aktuelles
                        </h3>
                        {news.map((item) => (
                            <Card key={item.id}>
                                <CardHeader>
                                    {item.category && (
                                        <p className="text-xs font-medium text-accent-copy">{item.category}</p>
                                    )}
                                    <CardTitle>{item.title}</CardTitle>
                                    {item.excerpt && <CardDescription>{item.excerpt}</CardDescription>}
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">
                            Termine
                        </h3>
                        {events.map((event) => (
                            <Card key={event.id}>
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center">
                                            <span className="text-xs uppercase text-copy-muted">
                                                {formatDate(event.startDate, "short")}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <CardTitle>{event.title}</CardTitle>
                                            {event.location && (
                                                <p className="mt-1 text-xs text-copy-muted">{event.location}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
