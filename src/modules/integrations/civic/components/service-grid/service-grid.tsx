import { serviceGridPropsSchema } from "./service-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardContent } from "@/components/ui/card";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { logger } from "@/lib/logger/logger";

const FALLBACK_ICON = "arrow-right" as const;
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

export async function ServiceGrid({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = serviceGridPropsSchema.safeParse(props);
    const { heading, columns, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Online-Leistungen", columns: 3 as const , datasetId: undefined};

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getServices();

    if (!result.ok) {
        logger.error("ServiceGrid failed to load services", { error: result.error });
        return <WidgetState kind="error" heading={heading} tone="muted" />;
    }

    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} tone="muted" />;

    return (
        <Section tone="muted" className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>

                <Grid columns={columns}>
                    {result.data.map((service) => (
                        <a key={service.id} href={service.href} className="group">
                            <Card className="h-full transition-colors group-hover:border-primary">
                                <CardContent className="flex items-center gap-3 pt-5">
                                    <DynamicIcon
                                        name={service.icon}
                                        fallback={FALLBACK_ICON}
                                        className="h-5 w-5 shrink-0 text-primary-copy"
                                        aria-hidden="true"
                                    />

                                    <span className="text-sm font-medium text-copy">
                                        {service.title}
                                    </span>
                                </CardContent>
                            </Card>
                        </a>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
