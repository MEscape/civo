import { Mail, Phone } from "@/components/ui/icons";
import { contactCardPropsSchema } from "./contact-card.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";

export async function ContactCard({ props }: { props: Record<string, unknown>}) {
    const parsed = contactCardPropsSchema.safeParse(props);
    const { heading, datasetId } = parsed.success ? parsed.data : { heading: "Kontakt" , datasetId: undefined};

    const provider = await getCivicDataProvider(datasetId);
    const result = await provider.getContacts();

    if (!result.ok) {
        logger.error("ContactCard failed to load contacts", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section className="relative">
            
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
                                            className="flex items-center gap-2 text-[var(--civo-color-primary)] hover:underline"
                                        >
                                            <Mail className="h-4 w-4" aria-hidden="true" />
                                            {contact.email}
                                        </a>
                                    )}
                                    {contact.phone && (
                                        <a
                                            href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                                            className="flex items-center gap-2 text-[var(--civo-color-text-muted)] hover:underline"
                                        >
                                            <Phone className="h-4 w-4" aria-hidden="true" />
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
