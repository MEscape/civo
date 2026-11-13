import { Mail, Phone } from '@components/icons/icons';
import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

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

/** A channel is a 44px row, underlined so it is not told by colour alone. */
const CHANNEL_LINK =
  'flex min-h-11 items-center gap-2 text-primary-copy underline decoration-1 underline-offset-4 [overflow-wrap:anywhere] hover:decoration-2';

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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={columnsForCount(items.length, MAX_COLUMNS)}>
          {items.map((contact) => (
            <li key={contact.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{contact.name}</CardTitle>
                  {contact.role !== undefined && <CardDescription>{contact.role}</CardDescription>}
                  <div className="mt-3 flex flex-col text-sm">
                    {contact.email !== undefined && (
                      <ContentLink href={`mailto:${contact.email}`} className={CHANNEL_LINK}>
                        <Mail className="size-4 shrink-0" aria-hidden="true" />
                        {contact.email}
                      </ContentLink>
                    )}
                    {contact.phone !== undefined && (
                      <ContentLink
                        href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                        className={`${CHANNEL_LINK} tabular-nums`}
                      >
                        <Phone className="size-4 shrink-0" aria-hidden="true" />
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
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
