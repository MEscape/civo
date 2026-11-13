import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { stripHtml, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { EventCard } from '../../shared/event-card';

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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={props.columns}>
          {items.map((event) => {
            const time = t('eventsGrid.time', {
              time: fmt.date(event.startDate, TIME_FORMAT),
            });
            const meta = [event.category, time, event.location].filter(
              (part): part is string => part !== undefined && part !== '',
            );
            const description =
              event.description !== undefined ? trimToNull(stripHtml(event.description)) : null;

            return (
              <li key={event.id}>
                <EventCard
                  event={event}
                  dayLabel={fmt.date(event.startDate, DAY_FORMAT)}
                  meta={meta}
                  description={description}
                  showImage
                />
              </li>
            );
          })}
        </Grid>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
