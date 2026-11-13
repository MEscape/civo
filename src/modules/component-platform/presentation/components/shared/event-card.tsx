import { Fragment } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import type { ContentListView } from '../../../application/contracts/content-views';

export type EventView = ContentListView<'Event'>['items'][number];

export interface EventCardProps {
  readonly event: EventView;
  /** The day box text, formatted for the request's locale by the caller. */
  readonly dayLabel: string;
  /** Short facts under the title (category, time, place); empty ones are left out by the caller. */
  readonly meta?: readonly string[];
  readonly description?: string | null;
  readonly showImage?: boolean;
}

/**
 * One event: a day box that anchors the eye, the title, a line of facts.
 * Full (image and description) in the grid, compact in the split column.
 */
export function EventCard({
  event,
  dayLabel,
  meta = [],
  description = null,
  showImage = false,
}: EventCardProps) {
  return (
    <Card className="h-full overflow-hidden">
      {showImage && event.imageUrl !== undefined && (
        // eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed
        <img
          src={event.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-40 w-full bg-canvas object-cover"
        />
      )}
      <CardHeader>
        <div className="flex items-start gap-3">
          <time
            dateTime={event.startDate}
            className="flex min-w-14 shrink-0 flex-col items-center rounded-token-sm border border-border bg-canvas px-2.5 py-1.5 text-center text-sm font-semibold whitespace-nowrap text-copy uppercase tabular-nums"
          >
            {dayLabel}
          </time>
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <CardTitle>
              {event.href !== undefined ? (
                <ContentLink href={event.href} className="hover:text-primary-copy hover:underline">
                  {event.title}
                </ContentLink>
              ) : (
                event.title
              )}
            </CardTitle>
            {meta.length > 0 && (
              <p className="mt-1 text-sm text-copy-muted">
                {meta.map((part, index) => (
                  <Fragment key={`${String(index)}-${part}`}>
                    {index > 0 && (
                      <>
                        {/* Spoken as a pause, shown as a dot. */}
                        <span className="sr-only">{', '}</span>
                        <span aria-hidden="true"> · </span>
                      </>
                    )}
                    {part}
                  </Fragment>
                ))}
              </p>
            )}
          </div>
        </div>
        {description !== null && <CardDescription className="mt-2">{description}</CardDescription>}
      </CardHeader>
    </Card>
  );
}
