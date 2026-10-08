import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';
import { Mail } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface DepartmentDirectoryComponentProps {
  readonly props: ComponentProps<'departmentDirectory'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Departments, each with its contact persons. */
export async function DepartmentDirectory({
  props,
  context,
  loadContent,
}: DepartmentDirectoryComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'Department',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('departmentDirectory.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section className="relative">
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={props.columns}>
          {items.map((department) => (
            <li key={department.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    {department.href !== undefined ? (
                      <ContentLink href={department.href} className="hover:text-primary-copy">
                        {department.name}
                      </ContentLink>
                    ) : (
                      department.name
                    )}
                  </CardTitle>
                  {department.description !== undefined && (
                    <CardDescription>{department.description}</CardDescription>
                  )}
                  <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                    {department.contacts.map((contact) => (
                      <li key={contact.id} className="flex items-center justify-between gap-2">
                        <span className="text-copy">{contact.name}</span>
                        {contact.email !== undefined && (
                          <ContentLink
                            href={`mailto:${contact.email}`}
                            aria-label={t('departmentDirectory.writeTo', {
                              name: contact.name,
                            })}
                            className="flex items-center gap-1.5 text-primary-copy hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          </ContentLink>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardHeader>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
