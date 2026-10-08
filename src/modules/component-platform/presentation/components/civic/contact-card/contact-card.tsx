import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';
import { Mail, Phone } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { columnsForCount } from '../../shared/grid-columns';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

const MAX_COLUMNS = 3;

export interface ContactCardComponentProps {
  readonly props: ComponentProps<'contactCard'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Contact persons of a bound dataset. */
export async function ContactCard({ props, context, loadContent }: ContactCardComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'Contact',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('contactCard.defaultHeading');

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
        <Grid as="ul" columns={columnsForCount(items.length, MAX_COLUMNS)}>
          {items.map((contact) => (
            <li key={contact.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{contact.name}</CardTitle>
                  {contact.role !== undefined && <CardDescription>{contact.role}</CardDescription>}
                  <div className="mt-3 flex flex-col gap-1.5 text-sm">
                    {contact.email !== undefined && (
                      <ContentLink
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-primary-copy hover:underline"
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        {contact.email}
                      </ContentLink>
                    )}
                    {contact.phone !== undefined && (
                      <ContentLink
                        href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                        className="flex items-center gap-2 text-copy-muted hover:underline"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {contact.phone}
                      </ContentLink>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
