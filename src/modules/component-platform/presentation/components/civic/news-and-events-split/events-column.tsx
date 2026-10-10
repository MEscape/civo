import { Card, CardHeader, CardTitle } from '@components/ui/card';

import type { ContentListView } from '../../../../application/contracts/content-views';

export interface EventsColumnProps {
  readonly heading: string;
  /** What replaces the list while its source is unavailable. */
  readonly unavailableText: string;
  /** `null`: the source failed. */
  readonly list: ContentListView<'Event'> | null;
  /** The day box of an event, formatted for the request's locale by the caller. */
  readonly formatDay: (instant: string) => string;
}

/** The events half of the split. A failing source degrades this column only. */
export function EventsColumn({ heading, unavailableText, list, formatDay }: EventsColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">{heading}</h3>
      {list === null ? (
        <p className="text-sm text-copy-muted">{unavailableText}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.items.map((event) => (
            <li key={event.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <time
                      dateTime={event.startDate}
                      className="flex shrink-0 flex-col items-center rounded-token-sm border border-border px-3 py-1.5 text-center text-xs uppercase text-copy-muted"
                    >
                      {formatDay(event.startDate)}
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
      )}
    </div>
  );
}
