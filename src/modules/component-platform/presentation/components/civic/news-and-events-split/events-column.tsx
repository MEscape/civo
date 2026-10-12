import type { ReactNode } from 'react';

import { Card, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

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
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <time
                      dateTime={event.startDate}
                      className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center text-xs uppercase text-copy-muted"
                    >
                      {formatDay(event.startDate)}
                    </time>
                    <div>
                      <CardTitle>
                        {event.href !== undefined ? (
                          <ContentLink href={event.href} className="hover:text-primary-copy">
                            {event.title}
                          </ContentLink>
                        ) : (
                          event.title
                        )}
                      </CardTitle>
                      {event.location !== undefined && (
                        <p className="mt-1 text-xs text-copy-muted">{event.location}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </SplitList>
      ) : (
        <p className="text-sm text-copy-muted">{list === null ? unavailableText : emptyText}</p>
      )}
    </SplitColumn>
  );
}
