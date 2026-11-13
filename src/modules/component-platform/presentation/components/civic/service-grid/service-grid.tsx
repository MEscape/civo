import { DynamicIcon } from '@components/icons/dynamic-icon';
import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={props.columns}>
          {items.map((service) => (
            <li key={service.id}>
              <ContentLink
                href={service.href}
                className="group flex h-full items-start gap-3 border-t border-border py-4 transition-interactive hover:border-primary"
              >
                <DynamicIcon
                  name={service.icon}
                  fallback={FALLBACK_ICON}
                  className="mt-0.5 size-5 shrink-0 text-primary-copy"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="block text-base font-medium text-copy underline-offset-4 transition-interactive group-hover:text-primary-copy group-hover:underline">
                    {service.title}
                  </span>
                  {service.description !== undefined && (
                    <p className="mt-1 line-clamp-2 text-sm text-copy-muted">
                      {stripHtml(service.description)}
                    </p>
                  )}
                </div>
              </ContentLink>
            </li>
          ))}
        </Grid>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
