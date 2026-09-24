import { cardGridPropsSchema } from "./card-grid.definition";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function CardGrid({ props }: { props: Record<string, unknown> }) {
    const parsed = cardGridPropsSchema.safeParse(props);
    const { heading, columns, cards } = parsed.success
        ? parsed.data
        : { heading: undefined, columns: 3 as const, cards: [] };

    if (cards.length === 0) return null;

    return (
        <Section>
            <Container>
                {heading && <SectionHeading>{heading}</SectionHeading>}
                <Grid columns={columns}>
                    {cards.map((card, index) => (
                        <Card key={`${card.title}-${index}`}>
                            <CardHeader>
                                <CardTitle>
                                    {card.href ? (
                                        <a href={card.href} className="hover:text-primary-copy">
                                            {card.title}
                                        </a>
                                    ) : (
                                        card.title
                                    )}
                                </CardTitle>
                                {card.description && <CardDescription>{card.description}</CardDescription>}
                            </CardHeader>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
