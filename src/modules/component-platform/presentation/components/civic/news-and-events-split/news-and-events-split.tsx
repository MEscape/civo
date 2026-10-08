import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

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

  if (newsResult.isErr() && eventsResult.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const hasNews = newsResult.isOk() && newsResult.value.items.length > 0;
  const hasEvents = eventsResult.isOk() && eventsResult.value.items.length > 0;
  if (!hasNews && !hasEvents && newsResult.isOk() && eventsResult.isOk()) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section>
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="relative flex flex-col gap-4">
            <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">
              {t('newsAndEventsSplit.newsHeading')}
            </h3>
            {newsResult.isErr() ? (
              <p className="text-sm text-copy-muted">{t('render.sectionUnavailable')}</p>
            ) : (
              <>
                <ContentOriginBadge origin={newsResult.value.origin} />
                <ul className="flex flex-col gap-4">
                  {newsResult.value.items.map((item) => (
                    <li key={item.id}>
                      <Card>
                        <CardHeader>
                          {item.category !== undefined && (
                            <p className="text-xs font-medium text-accent-copy">{item.category}</p>
                          )}
                          <CardTitle>{item.title}</CardTitle>
                          {item.excerpt !== undefined && (
                            <CardDescription>{item.excerpt}</CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="relative flex flex-col gap-4">
            <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">
              {t('newsAndEventsSplit.eventsHeading')}
            </h3>
            {eventsResult.isErr() ? (
              <p className="text-sm text-copy-muted">{t('render.sectionUnavailable')}</p>
            ) : (
              <>
                <ContentOriginBadge origin={eventsResult.value.origin} />
                <ul className="flex flex-col gap-4">
                  {eventsResult.value.items.map((event) => (
                    <li key={event.id}>
                      <Card>
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <time
                              dateTime={event.startDate}
                              className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center text-xs uppercase text-copy-muted"
                            >
                              {format.date(event.startDate, DAY_FORMAT)}
                            </time>
                            <div>
                              <CardTitle>{event.title}</CardTitle>
                              {event.location !== undefined && (
                                <p className="mt-1 text-xs text-copy-muted">{event.location}</p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
