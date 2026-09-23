import { councilBlockPropsSchema } from "./council-block.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger/logger";

/**
 * CouncilBlock — Gemeinderat & Ausschüsse. A genuinely municipal-specific
 * composite: no generic cardGrid/list arrangement captures "body name +
 * description + member roster with roles/parties" without per-website
 * hand-assembly. Renders each CouncilBody as its own card with a member
 * list, matching the Card chrome used everywhere else.
 */
export async function CouncilBlock({ props }: { props: Record<string, unknown>}) {
    const parsed = councilBlockPropsSchema.safeParse(props);
    const { heading, datasetId } = parsed.success ? parsed.data : { heading: "Gemeinderat & Ausschüsse" , datasetId: undefined};

    const provider = await getCivicDataProvider(datasetId);
    const result = await provider.getCouncilBodies();

    if (!result.ok) {
        logger.error("CouncilBlock failed to load council bodies", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section className="relative">
            
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <div className="flex flex-col gap-6">
                    {result.data.map((body) => (
                        <Card key={body.id}>
                            <CardContent className="pt-5">
                                <h3 className="font-[family-name:var(--civo-font-heading)] text-lg text-[var(--civo-color-text)]">
                                    {body.name}
                                </h3>
                                {body.description && (
                                    <p className="mt-1 text-sm text-[var(--civo-color-text-muted)]">{body.description}</p>
                                )}
                                <ul className="mt-4 flex flex-col divide-y divide-[var(--civo-color-border)]">
                                    {body.members.map((member) => (
                                        <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                                            <div>
                                                <p className="text-sm font-medium text-[var(--civo-color-text)]">
                                                    {member.name}
                                                </p>
                                                {member.role && (
                                                    <p className="text-xs text-[var(--civo-color-text-muted)]">{member.role}</p>
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
