import { eventsGridPropsSchema } from "./events-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { formatDate } from "@/lib/utils/formatters";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function EventsGrid({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = eventsGridPropsSchema.safeParse(props);
    const { heading, columns, limit, category, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Termine", columns: 3 as const, limit: 6, category: undefined, datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getEvents({ limit, category });

    if (!result.ok) {
        logger.error("EventsGrid failed to load events", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }

    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((event) => (
                        <Card key={event.id}>
                            <CardHeader>
                                <div className="flex items-start gap-3">
                                    <div className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center">
                    <span className="text-xs uppercase text-copy-muted">
                                            {formatDate(event.startDate, "short")}
                    </span>
                                    </div>
                                    <div>
                                        <CardTitle>{event.title}</CardTitle>
                                        <p className="mt-1 text-xs text-copy-muted">
                                            {formatDate(event.startDate, "time")} Uhr
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
