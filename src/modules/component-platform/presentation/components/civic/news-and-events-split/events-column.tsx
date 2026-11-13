import type { ReactNode } from 'react';

import { EventCard } from '../../shared/event-card';

import { SplitColumn } from './split-column';
import { SplitList } from './split-list';

import type { ContentListView } from '../../../../application/contracts/content-views';

export interface EventsColumnProps {
  readonly heading: string;
  /** What replaces the list while its source is unavailable. */
  readonly unavailableText: string;
  /** What replaces the list when the source is empty. */
  readonly emptyText: string;
  /** `null`: the source failed. */
  readonly list: ContentListView<'Event'> | null;
  /** The day box of an event, formatted for the request's locale by the caller. */
  readonly formatDay: (instant: string) => string;
  readonly badge?: ReactNode;
}

/** The events half of the split. A failing source degrades this column only. */
export function EventsColumn({
  heading,
  unavailableText,
  emptyText,
  list,
  formatDay,
  badge,
}: EventsColumnProps) {
  return (
    <SplitColumn heading={heading} badge={badge}>
      {list !== null && list.items.length > 0 ? (
        <SplitList>
          {list.items.map((event) => (
            <li key={event.id}>
              <EventCard
                event={event}
                dayLabel={formatDay(event.startDate)}
                meta={event.location !== undefined ? [event.location] : []}
              />
            </li>
          ))}
        </SplitList>
      ) : (
        <p className="text-sm text-copy-muted">{list === null ? unavailableText : emptyText}</p>
      )}
    </SplitColumn>
  );
}
