import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardContent } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';
import { DynamicIcon } from '@components/ui/dynamic-icon';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

const FALLBACK_ICON = 'arrowRight' as const;

export interface ServiceGridComponentProps {
  readonly props: ComponentProps<'serviceGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** A compact overview of the online services of a bound dataset. */
export async function ServiceGrid({ props, context, loadContent }: ServiceGridComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'Service',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('serviceGrid.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section tone="muted" className="relative">
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={props.columns}>
          {items.map((service) => (
            <li key={service.id}>
              <ContentLink href={service.href} className="group block h-full">
                <Card className="h-full transition-colors group-hover:border-primary">
                  <CardContent className="flex items-center gap-3 pt-5">
                    <DynamicIcon
                      name={service.icon}
                      fallback={FALLBACK_ICON}
                      className="h-5 w-5 shrink-0 text-primary-copy"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-copy">{service.title}</span>
                  </CardContent>
                </Card>
              </ContentLink>
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
