import type { CSSProperties } from 'react';

import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

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

type ColumnResult = Awaited<ReturnType<LoadContent>>;

/** Both sources failing is an error, both answering without records is empty; one failing column degrades alone. */
function splitState(results: readonly ColumnResult[]): 'error' | 'empty' | 'content' {
  if (results.every((result) => result.isErr())) {
    return 'error';
  }
  const isEmpty = results.every((result) => result.isOk() && result.value.items.length === 0);
  return isEmpty ? 'empty' : 'content';
}

const HEADING_ROW = 1;
/** A column that failed still shows its one-line notice below the heading. */
const NOTICE_ROW = 1;

/**
 * The rows of the split's grid: the heading plus as many cards as the longer
 * column has. A count is data, so it travels as a custom property that the
 * grid's class reads; React's `CSSProperties` has no custom-property keys.
 */
function splitRows(results: readonly ColumnResult[]): CSSProperties {
  const cards = Math.max(
    NOTICE_ROW,
    ...results.map((result) => (result.isOk() ? result.value.items.length : 0)),
  );
  return { '--split-rows': HEADING_ROW + cards } as CSSProperties;
}

/**
 * "Aktuelles" and "Termine" side by side under one heading. It loads the
 * same two kinds the standalone grids do; only the layout differs. A column
 * whose source fails degrades on its own instead of taking the other down.
 */
export async function NewsAndEventsSplit({
  props,
  context,
  loadContent,
}: NewsAndEventsSplitComponentProps) {
  const [t, format, newsResult, eventsResult] = await Promise.all([
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
  const heading = trimToNull(props.heading) ?? t('newsAndEventsSplit.defaultHeading');

  const results = [newsResult, eventsResult];
  const state = splitState(results);
  if (state !== 'content') {
    return <ContentState kind={state} heading={heading} />;
  }

  const newsOrigin =
    newsResult.isOk() && newsResult.value.origin.kind === 'sample' ? newsResult.value.origin : null;
  const eventsOrigin =
    eventsResult.isOk() && eventsResult.value.origin.kind === 'sample'
      ? eventsResult.value.origin
      : null;

  return (
    <Section>
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <div className="@container">
          <div
            className="grid grid-cols-1 gap-10 @3xl:grid-cols-2 @3xl:gap-x-10 @3xl:gap-y-4 @3xl:grid-rows-[repeat(var(--split-rows),auto)]"
            style={splitRows(results)}
          >
            <NewsColumn
              heading={t('newsAndEventsSplit.newsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              emptyText={t('states.empty')}
              showMoreLabel={t('render.showMore')}
              showLessLabel={t('render.showLess')}
              list={newsResult.isOk() ? newsResult.value : null}
              formatDay={(instant) => format.date(instant, DAY_FORMAT)}
              badge={
                newsOrigin !== null ? (
                  <ContentOriginBadge origin={newsOrigin} placement="inline" />
                ) : null
              }
            />
            <EventsColumn
              heading={t('newsAndEventsSplit.eventsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              emptyText={t('states.empty')}
              list={eventsResult.isOk() ? eventsResult.value : null}
              formatDay={(instant) => format.date(instant, DAY_FORMAT)}
              badge={
                eventsOrigin !== null ? (
                  <ContentOriginBadge origin={eventsOrigin} placement="inline" />
                ) : null
              }
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
