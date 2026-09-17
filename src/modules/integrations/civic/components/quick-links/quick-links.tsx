import { ArrowRight } from "@/components/ui/icons";
import { quickLinksPropsSchema } from "./quick-links.definition";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";

export function QuickLinks({ props }: { props: Record<string, unknown> }) {
    const parsed = quickLinksPropsSchema.safeParse(props);
    const { heading, links } = parsed.success ? parsed.data : { heading: "Schnellzugriff", links: [] };

    if (links.length === 0) return null;

    return (
        <Section tone="muted">
            <Container className="max-w-3xl">
                <SectionHeading>{heading}</SectionHeading>
                <ul className="divide-y divide-[var(--civo-color-border)]">
                    {links.map((link, index) => (
                        <li key={`${link.href}-${index}`}>
                            <a
                                href={link.href}
                                className="flex items-center justify-between py-3 text-sm font-medium text-[var(--civo-color-text)] hover:text-[var(--civo-color-primary)]"
                            >
                                {link.label}
                                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                            </a>
                        </li>
                    ))}
                </ul>
            </Container>
        </Section>
    );
}
