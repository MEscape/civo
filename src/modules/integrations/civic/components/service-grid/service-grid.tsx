import { serviceGridPropsSchema } from "./service-grid.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { logger } from "@/lib/logger/logger";

const FALLBACK_ICON = "arrow-right" as const;

export async function ServiceGrid({ props }: { props: Record<string, unknown> }) {
    const parsed = serviceGridPropsSchema.safeParse(props);
    const { heading, columns } = parsed.success
        ? parsed.data
        : { heading: "Online-Leistungen", columns: 3 as const };

    const provider = getCivicDataProvider();
    const result = await provider.getServices();

    if (!result.ok) {
        logger.error("ServiceGrid failed to load services", { error: result.error });
        return null;
    }

    if (result.data.length === 0) return null;

    return (
        <Section tone="muted">
            <Container>
                <SectionHeading>{heading}</SectionHeading>

                <Grid columns={columns}>
                    {result.data.map((service) => (
                        <a key={service.id} href={service.href} className="group">
                            <Card className="h-full transition-colors group-hover:border-[var(--civo-color-primary)]">
                                <CardContent className="flex items-center gap-3 pt-5">
                                    <DynamicIcon
                                        name={service.icon}
                                        fallback={FALLBACK_ICON}
                                        className="h-5 w-5 shrink-0 text-[var(--civo-color-primary)]"
                                        aria-hidden="true"
                                    />

                                    <span className="text-sm font-medium text-[var(--civo-color-text)]">
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
