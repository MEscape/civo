import { openingHoursPropsSchema } from "./opening-hours.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import type { OpeningHoursEntry } from "@/modules/content/domain/civic-types";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

const dayLabels: Record<OpeningHoursEntry["day"], string> = {
    mon: "Montag",
    tue: "Dienstag",
    wed: "Mittwoch",
    thu: "Donnerstag",
    fri: "Freitag",
    sat: "Samstag",
    sun: "Sonntag",
};

export async function OpeningHours({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = openingHoursPropsSchema.safeParse(props);
    const { heading, datasetId } = parsed.success ? parsed.data : { heading: "Öffnungszeiten", datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getOpeningHours();

    if (!result.ok) {
        logger.error("OpeningHours failed to load", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container className="max-w-xl">
                <SectionHeading>{heading}</SectionHeading>
                <Card>
                    <CardContent className="pt-5">
                        <dl className="divide-y divide-border">
                            {result.data.map((entry) => (
                                <div key={entry.day} className="flex items-center justify-between py-2.5 text-sm">
                                    <dt className="text-copy">{dayLabels[entry.day]}</dt>
                                    <dd className="text-copy-muted">
                                        {entry.closed ? "Geschlossen" : `${entry.opensAt} – ${entry.closesAt} Uhr`}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
            </Container>
        </Section>
    );
}
