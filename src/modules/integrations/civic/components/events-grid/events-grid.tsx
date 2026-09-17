import { eventsGridPropsSchema } from "./events-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

export async function EventsGrid({ props, websiteId }: { props: Record<string, unknown>; websiteId?: string }) {
    const parsed = eventsGridPropsSchema.safeParse(props);
    const { heading, columns, limit, category } = parsed.success
        ? parsed.data
        : { heading: "Termine", columns: 3 as const, limit: 6, category: undefined };

    const provider = await getCivicDataProvider(websiteId);
    const result = await provider.getEvents({ limit, category });

    if (!result.ok) {
        logger.error("EventsGrid failed to load events", { error: result.error });
        return (
            <Section>
                <Container>
                    <SectionHeading>{heading}</SectionHeading>
                    <p className="text-sm text-[var(--civo-color-text-muted)]">
                        Termine konnten derzeit nicht geladen werden.
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
                    {result.data.map((event) => (
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
                                        <p className="mt-1 text-xs text-[var(--civo-color-text-muted)]">
                                            {timeFormatter.format(event.startDate)} Uhr
                                            {event.location ? ` · ${event.location}` : ""}
                                        </p>
                                    </div>
                                </div>
                                {event.description && (
                                    <CardDescription className="mt-2">{event.description}</CardDescription>
                                )}
                            </CardHeader>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
