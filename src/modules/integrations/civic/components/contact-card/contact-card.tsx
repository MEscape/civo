import { Mail, Phone } from "@/components/ui/icons";
import { contactCardPropsSchema } from "./contact-card.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function ContactCard({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = contactCardPropsSchema.safeParse(props);
    const { heading, datasetId } = parsed.success ? parsed.data : { heading: "Kontakt", datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getContacts();

    if (!result.ok) {
        logger.error("ContactCard failed to load contacts", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={result.data.length >= 3 ? 3 : (result.data.length as 1 | 2)}>
                    {result.data.map((contact) => (
                        <Card key={contact.id}>
                            <CardHeader>
                                <CardTitle>{contact.name}</CardTitle>
                                {contact.role && <CardDescription>{contact.role}</CardDescription>}
                                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                                    {contact.email && (
                                        <a
                                            href={`mailto:${contact.email}`}
                                            className="flex min-h-6 items-center gap-2 wrap-anywhere text-primary-copy hover:underline pointer-coarse:min-h-11"
                                        >
                                            <Mail className="size-4 shrink-0" aria-hidden="true" />
                                            {contact.email}
                                        </a>
                                    )}
                                    {contact.phone && (
                                        <a
                                            href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                                            className="flex min-h-6 items-center gap-2 wrap-anywhere text-copy-muted hover:underline pointer-coarse:min-h-11"
                                        >
                                            <Phone className="size-4 shrink-0" aria-hidden="true" />
                                            {contact.phone}
                                        </a>
                                    )}
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
