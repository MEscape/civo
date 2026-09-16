import { newsAndEventsSplitPropsSchema } from "./news-and-events-split.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });

/**
 * NewsAndEventsSplit — the extremely common municipal-homepage pattern
 * of "Aktuelles" and "Termine" side by side under one heading. Saves an
 * editor from manually placing two separate grids + matching headings
 * every time (spec: "richer composites" over generic building blocks).
 * Internally still just calls the same provider methods newsGrid/
 * eventsGrid use — no new data-fetching logic, just a different layout.
 */
export async function NewsAndEventsSplit({ props }: { props: Record<string, unknown> }) {
    const parsed = newsAndEventsSplitPropsSchema.safeParse(props);
    const { heading, newsLimit, eventsLimit } = parsed.success
        ? parsed.data
        : { heading: "Aktuelles & Termine", newsLimit: 4, eventsLimit: 4 };

    const provider = getCivicDataProvider();
    // Fetch both in parallel
    const [newsResult, eventsResult] = await Promise.all([
        provider.getNews({ limit: newsLimit }),
        provider.getEvents({ limit: eventsLimit }),
    ]);

    if (!newsResult.ok || !eventsResult.ok) {
        if (!newsResult.ok) logger.error("NewsAndEventsSplit failed to load news", { error: newsResult.error });
        if (!eventsResult.ok) logger.error("NewsAndEventsSplit failed to load events", { error: eventsResult.error });
    }

    const news = newsResult.ok ? newsResult.data : [];
    const events = eventsResult.ok ? eventsResult.data : [];

    if (news.length === 0 && events.length === 0) return null;

    return (
        <Section>
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                            Aktuelles
                        </h3>
                        {news.map((item) => (
                            <Card key={item.id}>
                                <CardHeader>
                                    {item.category && (
                                        <p className="text-xs font-medium text-[var(--civo-color-accent)]">{item.category}</p>
                                    )}
                                    <CardTitle>{item.title}</CardTitle>
                                    {item.excerpt && <CardDescription>{item.excerpt}</CardDescription>}
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                            Termine
                        </h3>
                        {events.map((event) => (
                            <Card key={event.id}>
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="flex shrink-0 flex-col items-center rounded-[calc(var(--civo-radius)_-_2px)] border border-[var(--civo-color-border)] px-3 py-1.5 text-center">
                                            <span className="text-xs uppercase text-[var(--civo-color-text-muted)]">
                                                {dateFormatter.format(event.startDate)}
                                            </span>
                                        </div>
                                        <div>
                                            <CardTitle>{event.title}</CardTitle>
                                            {event.location && (
                                                <p className="mt-1 text-xs text-[var(--civo-color-text-muted)]">{event.location}</p>
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
