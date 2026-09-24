import { Mail } from "@/components/ui/icons";
import { departmentDirectoryPropsSchema } from "./department-directory.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * DepartmentDirectory — Ämter & Fachbereiche. Richer than `contactCard`
 * (spec: civic composites batch): groups contacts under a department
 * with its own description and optional link to a dedicated department
 * page, rather than a flat list of individual people.
 */
export async function DepartmentDirectory({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = departmentDirectoryPropsSchema.safeParse(props);
    const { heading, columns, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Ämter & Fachbereiche", columns: 2 as const, datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getDepartments();

    if (!result.ok) {
        logger.error("DepartmentDirectory failed to load departments", { error: result.error });
        return <WidgetState kind="error" heading={heading} />;
    }
    if (result.data.length === 0) return <WidgetState kind="empty" heading={heading} />;

    return (
        <Section className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((department) => (
                        <Card key={department.id}>
                            <CardHeader>
                                <CardTitle>
                                    {department.href ? (
                                        <a href={department.href} className="hover:text-primary-copy">
                                            {department.name}
                                        </a>
                                    ) : (
                                        department.name
                                    )}
                                </CardTitle>
                                {department.description && <CardDescription>{department.description}</CardDescription>}
                                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                                    {department.contacts.map((contact) => (
                                        <li key={contact.id} className="flex items-center justify-between gap-2">
                                            <span className="text-copy">{contact.name}</span>
                                            {contact.email && (
                                                <a
                                                    href={`mailto:${contact.email}`}
                                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-token-sm text-primary-copy hover:bg-canvas pointer-coarse:size-11"
                                                >
                                                    <Mail className="size-3.5" aria-hidden="true" />
                                                    <span className="sr-only">E-Mail an {contact.name}</span>
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </CardHeader>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
}
