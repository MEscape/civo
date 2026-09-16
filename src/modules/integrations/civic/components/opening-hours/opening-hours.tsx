import { openingHoursPropsSchema } from "./opening-hours.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import type { OpeningHoursEntry } from "@/modules/content/domain/content-types";

const dayLabels: Record<OpeningHoursEntry["day"], string> = {
    mon: "Montag",
    tue: "Dienstag",
    wed: "Mittwoch",
    thu: "Donnerstag",
    fri: "Freitag",
    sat: "Samstag",
    sun: "Sonntag",
};

export async function OpeningHours({ props }: { props: Record<string, unknown> }) {
    const parsed = openingHoursPropsSchema.safeParse(props);
    const { heading } = parsed.success ? parsed.data : { heading: "Öffnungszeiten" };

    const provider = getCivicDataProvider();
    const result = await provider.getOpeningHours();

    if (!result.ok) {
        logger.error("OpeningHours failed to load", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section>
            <Container className="max-w-xl">
                <SectionHeading>{heading}</SectionHeading>
                <Card>
                    <CardContent className="pt-5">
                        <dl className="divide-y divide-[var(--civo-color-border)]">
                            {result.data.map((entry) => (
                                <div key={entry.day} className="flex items-center justify-between py-2.5 text-sm">
                                    <dt className="text-[var(--civo-color-text)]">{dayLabels[entry.day]}</dt>
                                    <dd className="text-[var(--civo-color-text-muted)]">
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
