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
import type { ContentOrigin } from '../../../../application/contracts/content-views';
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

/** The note about placeholder records is shown once for the whole block, not once per column. */
function firstSampleOrigin(results: readonly ColumnResult[]): ContentOrigin | null {
  for (const result of results) {
    if (result.isOk() && result.value.origin.kind === 'sample') {
      return result.value.origin;
    }
  }
  return null;
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

  const sampleOrigin = firstSampleOrigin(results);

  return (
    <Section>
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        {sampleOrigin !== null && <ContentOriginBadge origin={sampleOrigin} placement="inline" />}
        <div className="@container">
          <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-2">
            <NewsColumn
              heading={t('newsAndEventsSplit.newsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              list={newsResult.isOk() ? newsResult.value : null}
            />
            <EventsColumn
              heading={t('newsAndEventsSplit.eventsHeading')}
              unavailableText={t('render.sectionUnavailable')}
              list={eventsResult.isOk() ? eventsResult.value : null}
              formatDay={(instant) => format.date(instant, DAY_FORMAT)}
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
