import { councilBlockPropsSchema } from "./council-block.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger/logger";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * CouncilBlock — Gemeinderat & Ausschüsse. A genuinely municipal-specific
 * composite: no generic cardGrid/list arrangement captures "body name +
 * description + member roster with roles/parties" without per-website
 * hand-assembly. Renders each CouncilBody as its own card with a member
 * list, matching the Card chrome used everywhere else.
 */
export async function CouncilBlock({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = councilBlockPropsSchema.safeParse(props);
    const { heading, datasetId } = parsed.success ? parsed.data : { heading: "Gemeinderat & Ausschüsse", datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getCouncilBodies();

    if (!result.ok) {
        logger.error("CouncilBlock failed to load council bodies", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <div className="flex flex-col gap-6">
                    {result.data.map((body) => (
                        <Card key={body.id}>
                            <CardContent className="pt-5">
                                <h3 className="font-heading text-lg text-copy">
                                    {body.name}
                                </h3>
                                {body.description && (
                                    <p className="mt-1 text-sm text-copy-muted">{body.description}</p>
                                )}
                                <ul className="mt-4 flex flex-col divide-y divide-border">
                                    {body.members.map((member) => (
                                        <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                                            <div>
                                                <p className="text-sm font-medium text-copy">
                                                    {member.name}
                                                </p>
                                                {member.role && (
                                                    <p className="text-xs text-copy-muted">{member.role}</p>
                                                )}
                                            </div>
                                            {member.party && <Badge variant="muted">{member.party}</Badge>}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </Container>
        </Section>
    );
}
