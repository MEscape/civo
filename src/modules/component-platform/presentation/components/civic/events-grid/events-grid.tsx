import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
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
const TIME_FORMAT = { timeStyle: 'short' } as const;

export interface EventsGridComponentProps {
  readonly props: ComponentProps<'eventsGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Upcoming events of a bound dataset, nearest first. */
export async function EventsGrid({ props, context, loadContent }: EventsGridComponentProps) {
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'Event',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: props.category,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('eventsGrid.defaultHeading');

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
        <Grid as="ul" columns={props.columns}>
          {items.map((event) => {
            const time = t('eventsGrid.time', {
              time: fmt.date(event.startDate, TIME_FORMAT),
            });
            const details = [time, event.location].filter(Boolean).join(' · ');

            return (
              <li key={event.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <time
                        dateTime={event.startDate}
                        className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center text-xs uppercase text-copy-muted"
                      >
                        {fmt.date(event.startDate, DAY_FORMAT)}
                      </time>
                      <div>
                        <CardTitle>{event.title}</CardTitle>
                        <p className="mt-1 text-xs text-copy-muted">{details}</p>
                      </div>
                    </div>
                    {event.description !== undefined && (
                      <CardDescription className="mt-2">{event.description}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
