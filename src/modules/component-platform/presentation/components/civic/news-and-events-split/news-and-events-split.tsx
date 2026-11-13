import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';

import { EventsColumn } from './events-column';
import { NewsColumn } from './news-column';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

const DAY_FORMAT = { day: '2-digit', month: 'short' } as const;

export interface NewsAndEventsSplitComponentProps {
  readonly props: ComponentProps<'newsAndEventsSplit'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Each column keeps its own source status and sample-data note. */
export async function NewsAndEventsSplit({
  props,
  context,
  loadContent,
}: NewsAndEventsSplitComponentProps) {
  const [t, format, news, events] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'NewsItem',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.newsDatasetId,
      limit: props.newsLimit,
    }),
    loadContent({
      kind: 'Event',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.eventsDatasetId,
      limit: props.eventsLimit,
    }),
  ]);

  return (
    <Section>
      <Container>
        <SectionHeading>
          {trimToNull(props.heading) ?? t('newsAndEventsSplit.defaultHeading')}
        </SectionHeading>
        <div className="@container">
          <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-2 @3xl:gap-12">
            <NewsColumn
              heading={t('newsAndEventsSplit.newsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              emptyText={t('states.empty')}
              showMoreLabel={t('render.showMore')}
              showLessLabel={t('render.showLess')}
              list={news.isOk() ? news.value : null}
              formatDay={(instant) => format.date(instant, DAY_FORMAT)}
              badge={
                news.isOk() ? (
                  <ContentOriginBadge origin={news.value.origin} placement="inline" />
                ) : undefined
              }
            />
            <EventsColumn
              heading={t('newsAndEventsSplit.eventsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              emptyText={t('states.empty')}
              list={events.isOk() ? events.value : null}
              formatDay={(instant) => format.date(instant, DAY_FORMAT)}
              badge={
                events.isOk() ? (
                  <ContentOriginBadge origin={events.value.origin} placement="inline" />
                ) : undefined
              }
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
