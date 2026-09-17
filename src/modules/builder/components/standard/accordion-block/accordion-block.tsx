import { accordionPropsSchema } from "./accordion-block.definition";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

export function AccordionBlock({ props }: { props: Record<string, unknown> }) {
    const parsed = accordionPropsSchema.safeParse(props);
    const { heading, items } = parsed.success ? parsed.data : { heading: undefined, items: [] };

    if (items.length === 0) return null;

    return (
        <Section>
            <Container className="max-w-3xl">
                {heading && <SectionHeading>{heading}</SectionHeading>}
                <Accordion type="single" collapsible>
                    {items.map((item, index) => (
                        <AccordionItem key={`${item.question}-${index}`} value={`item-${index}`}>
                            <AccordionTrigger>{item.question}</AccordionTrigger>
                            <AccordionContent>{item.answer}</AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </Container>
        </Section>
    );
}
