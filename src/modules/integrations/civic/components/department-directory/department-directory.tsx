import { Mail } from "@/components/ui/icons";
import { departmentDirectoryPropsSchema } from "./department-directory.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, Grid, SectionHeading } from "@/components/layout/layout-primitives";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger/logger";

/**
 * DepartmentDirectory — Ämter & Fachbereiche. Richer than `contactCard`
 * (spec: civic composites batch): groups contacts under a department
 * with its own description and optional link to a dedicated department
 * page, rather than a flat list of individual people.
 */
export async function DepartmentDirectory({ props }: { props: Record<string, unknown>}) {
    const parsed = departmentDirectoryPropsSchema.safeParse(props);
    const { heading, columns, datasetId } = parsed.success
        ? parsed.data
        : { heading: "Ämter & Fachbereiche", columns: 2 as const , datasetId: undefined};

    const provider = await getCivicDataProvider(datasetId);
    const result = await provider.getDepartments();

    if (!result.ok) {
        logger.error("DepartmentDirectory failed to load departments", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    return (
        <Section className="relative">
            
            <Container>
                <SectionHeading>{heading}</SectionHeading>
                <Grid columns={columns}>
                    {result.data.map((department) => (
                        <Card key={department.id}>
                            <CardHeader>
                                <CardTitle>
                                    {department.href ? (
                                        <a href={department.href} className="hover:text-[var(--civo-color-primary)]">
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
                                            <span className="text-[var(--civo-color-text)]">{contact.name}</span>
                                            {contact.email && (
                                                <a
                                                    href={`mailto:${contact.email}`}
                                                    className="flex items-center gap-1.5 text-[var(--civo-color-primary)] hover:underline"
                                                >
                                                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
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
