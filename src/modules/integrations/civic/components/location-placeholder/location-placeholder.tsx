import { MapPin } from "@/components/ui/icons";
import { locationPlaceholderPropsSchema } from "./location-placeholder.definition";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";

/**
 * A deliberate placeholder, not a real map integration (spec §7:
 * "Location/map placeholder"). A real map provider is an external API
 * integration decision left for later — wiring one in now would violate
 * the "don't implement a generic map-any-API engine" principle for a
 * single component.
 */
export function LocationPlaceholder({ props }: { props: Record<string, unknown> }) {
    const parsed = locationPlaceholderPropsSchema.safeParse(props);
    const { heading, address } = parsed.success
        ? parsed.data
        : { heading: "Anfahrt", address: undefined };

    return (
        <Section>
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] text-[var(--civo-color-text-muted)]">
                    <MapPin className="h-6 w-6" aria-hidden="true" />
                    {address && <p className="text-sm">{address}</p>}
                </div>
            </Container>
        </Section>
    );
}
