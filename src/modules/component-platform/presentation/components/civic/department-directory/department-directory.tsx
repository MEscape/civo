import { Mail } from '@components/icons/icons';
import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import { getTranslations } from '@i18n/server';

import { stripHtml, trimToNull } from '@lib/utils';

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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={props.columns}>
          {items.map((department) => (
            <li key={department.id}>
              <Card className="flex h-full flex-col">
                <CardHeader className="flex-1">
                  <CardTitle>
                    {department.href !== undefined ? (
                      <ContentLink
                        href={department.href}
                        className="hover:text-primary-copy hover:underline"
                      >
                        {department.name}
                      </ContentLink>
                    ) : (
                      department.name
                    )}
                  </CardTitle>
                  {department.description !== undefined && (
                    <CardDescription>{stripHtml(department.description)}</CardDescription>
                  )}
                  {department.contacts !== undefined && department.contacts.length > 0 && (
                    <div className="mt-auto pt-3">
                      <ul className="flex flex-col divide-y divide-border border-t border-border text-sm">
                        {department.contacts.map((contact) => (
                          <li
                            key={contact.id}
                            className="flex min-h-11 items-center justify-between gap-3"
                          >
                            <span className="min-w-0 text-copy [overflow-wrap:anywhere]">
                              {contact.name}
                            </span>
                            {contact.email !== undefined && (
                              <ContentLink
                                href={`mailto:${contact.email}`}
                                aria-label={t('departmentDirectory.writeTo', {
                                  name: contact.name,
                                })}
                                className="inline-flex size-11 shrink-0 items-center justify-center rounded-token-sm text-primary-copy transition-interactive hover:bg-canvas"
                              >
                                <Mail className="size-4" aria-hidden="true" />
                              </ContentLink>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
