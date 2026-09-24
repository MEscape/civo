import { serviceFinderPropsSchema } from "./service-finder.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { logger } from "@/lib/logger/logger";
import { ServiceFinderClient } from "./service-finder-client";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * ServiceFinder — searchable/filterable Bürgerservice directory (spec:
 * civic composites batch), richer than `serviceGrid`. The Server
 * Component fetches the full ServiceDetail[] once; filtering itself
 * happens client-side in ServiceFinderClient so typing in the search box
 * doesn't round-trip to the server. This keeps the "use client" boundary
 * to just the interactive list (spec §14), while the data-fetching stays
 * server-side and provider-abstracted like every other civic component.
 */

export async function ServiceFinder({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = serviceFinderPropsSchema.safeParse(props);
    const { heading, description, placeholder, initialCategory, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Leistungen finden", description: undefined, placeholder: "Leistung suchen…", initialCategory: undefined, datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getServiceDetails();

    if (!result.ok) {
        logger.error("ServiceFinder failed to load service details", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                {description && (
                    <p className="-mt-6 mb-8 max-w-2xl text-sm text-copy-muted">{description}</p>
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
