import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import { ServiceFinderClient } from './service-finder.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface ServiceFinderComponentProps {
  readonly props: ComponentProps<'serviceFinder'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * Searchable Bürgerservice directory. The server loads the records once;
 * filtering runs in the client leaf so typing never round-trips.
 */
export async function ServiceFinder({ props, context, loadContent }: ServiceFinderComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'ServiceDetail',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('serviceFinder.defaultHeading');
  const description = trimToNull(props.description);
  const placeholder = trimToNull(props.placeholder) ?? t('serviceFinder.defaultPlaceholder');

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
        {description !== null && (
          <p className="-mt-6 mb-8 max-w-2xl text-sm text-copy-muted">{description}</p>
        )}
        <ServiceFinderClient
          services={items}
          placeholder={placeholder}
          initialCategory={trimToNull(props.initialCategory) ?? ''}
          labels={{
            allCategories: t('serviceFinder.allCategories'),
            noResults: t('serviceFinder.noResults'),
          }}
        />
      </Container>
    </Section>
  );
}
