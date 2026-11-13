import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import { serviceFinderTexts } from './service-finder-texts';
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
  const text = serviceFinderTexts(props, {
    heading: t('serviceFinder.defaultHeading'),
    placeholder: t('serviceFinder.defaultPlaceholder'),
  });

  if (result.isErr()) {
    return <ContentState kind="error" heading={text.heading} />;
  }
  if (result.value.items.length === 0) {
    return <ContentState kind="empty" heading={text.heading} />;
  }

  return (
    <Section className="relative">
      <Container>
        <SectionHeading>{text.heading}</SectionHeading>
        {text.description !== null && (
          <p className="-mt-4 mb-8 max-w-2xl text-sm text-copy-muted">{text.description}</p>
        )}
        {/* Keyed by the start category: the client seeds its state from it once, so a changed prop (the editor) must restart it. */}
        <ServiceFinderClient
          key={text.initialCategory}
          services={result.value.items}
          placeholder={text.placeholder}
          initialCategory={text.initialCategory}
          labels={{
            allCategories: t('serviceFinder.allCategories'),
            noResults: t('serviceFinder.noResults'),
            search: t('serviceFinder.searchLabel'),
            categories: t('serviceFinder.categoriesLabel'),
            // The client fills the count in; the placeholder passes through as text.
            resultCount: t('serviceFinder.resultCount', { count: '{count}' }),
          }}
        />
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
