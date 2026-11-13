import type { ReactNode } from 'react';

import { Card, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import type { ContentListView } from '../../../application/contracts/content-views';

export type NewsItemView = ContentListView<'NewsItem'>['items'][number];

export interface NewsCardProps {
  readonly item: NewsItemView;
  /** The date as text, formatted for the request's locale by the caller; without it no date is shown. */
  readonly dateLabel?: string | undefined;
  /** The excerpt: a plain `CardDescription` in the grid, a `ClampedText` in the split. */
  readonly description?: ReactNode;
  readonly showImage?: boolean;
}

/** One news item: category and date, title, excerpt. Full (with picture) in the grid, compact in the split. */
export function NewsCard({ item, dateLabel, description, showImage = false }: NewsCardProps) {
  const hasMeta = item.category !== undefined || dateLabel !== undefined;

  return (
    <Card className="h-full overflow-hidden">
      {showImage && item.imageUrl !== undefined && (
        // eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-40 w-full bg-canvas object-cover"
        />
      )}
      <CardHeader>
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-copy-muted">
            {item.category !== undefined && (
              <span className="font-medium text-accent-copy">{item.category}</span>
            )}
            {dateLabel !== undefined && (
              <time dateTime={item.publishedAt} className="ms-auto tabular-nums">
                {dateLabel}
              </time>
            )}
          </div>
        )}
        <CardTitle>
          {item.href !== undefined ? (
            <ContentLink href={item.href} className="hover:text-primary-copy hover:underline">
              {item.title}
            </ContentLink>
          ) : (
            item.title
          )}
        </CardTitle>
        {description}
      </CardHeader>
    </Card>
  );
}
