import { serviceFinderPropsSchema } from "./service-finder.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import { ServiceFinderClient } from "./service-finder-client";

/**
 * ServiceFinder — searchable/filterable Bürgerservice directory (spec:
 * civic composites batch), richer than `serviceGrid`. The Server
 * Component fetches the full ServiceDetail[] once; filtering itself
 * happens client-side in ServiceFinderClient so typing in the search box
 * doesn't round-trip to the server. This keeps the "use client" boundary
 * to just the interactive list (spec §14), while the data-fetching stays
 * server-side and provider-abstracted like every other civic component.
 */
export async function ServiceFinder({ props }: { props: Record<string, unknown>}) {
    const parsed = serviceFinderPropsSchema.safeParse(props);
    const { heading, description, placeholder, initialCategory, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Leistungen finden", description: undefined, placeholder: "Leistung suchen…", initialCategory: undefined , datasetId: undefined};

    const provider = await getCivicDataProvider(datasetId);
    const result = await provider.getServiceDetails();

    if (!result.ok) {
        logger.error("ServiceFinder failed to load service details", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section className="relative">
            
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                {description && (
                    <p className="-mt-6 mb-8 max-w-2xl text-sm text-[var(--civo-color-text-muted)]">{description}</p>
                )}
                <ServiceFinderClient
                    services={result.data}
                    placeholder={placeholder}
                    initialCategory={initialCategory}
                />
            </Container>
        </Section>
    );
}
