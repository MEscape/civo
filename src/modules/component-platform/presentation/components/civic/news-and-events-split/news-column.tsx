import type { ReactNode } from 'react';

import { Card, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import { stripHtml, trimToNull } from '@lib/utils';

import { ClampedText } from '../../shared/clamped-text.client';

import { SplitColumn } from './split-column';
import { SplitList } from './split-list';

import type { ContentListView } from '../../../../application/contracts/content-views';

export interface NewsColumnProps {
  readonly heading: string;
  /** What replaces the list while its source is unavailable. */
  readonly unavailableText: string;
  /** What replaces the list when the source is empty. */
  readonly emptyText: string;
  readonly showMoreLabel: string;
  readonly showLessLabel: string;
  /** `null`: the source failed. */
  readonly list: ContentListView<'NewsItem'> | null;
  readonly badge?: ReactNode;
  readonly formatDay?: ((instant: string) => string) | undefined;
}

/** The news half of the split. A failing source degrades this column only. */
export function NewsColumn({
  heading,
  unavailableText,
  emptyText,
  showMoreLabel,
  showLessLabel,
  list,
  badge,
  formatDay,
}: NewsColumnProps) {
  return (
    <SplitColumn heading={heading} badge={badge}>
      {list !== null && list.items.length > 0 ? (
        <SplitList>
          {list.items.map((item) => {
            const rawText = item.excerpt ?? item.content;
            const description =
              rawText !== undefined ? (trimToNull(stripHtml(rawText)) ?? undefined) : undefined;

            return (
              <li key={item.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 text-xs text-copy-muted">
                      {item.category !== undefined ? (
                        <span className="font-medium text-accent-copy">{item.category}</span>
                      ) : (
                        <span />
                      )}
                      {formatDay !== undefined && (
                        <time dateTime={item.publishedAt}>{formatDay(item.publishedAt)}</time>
                      )}
                    </div>
                    <CardTitle>
                      {item.href !== undefined ? (
                        <ContentLink href={item.href} className="hover:text-primary-copy">
                          {item.title}
                        </ContentLink>
                      ) : (
                        item.title
                      )}
                    </CardTitle>
                    {description !== undefined && (
                      <ClampedText
                        text={description}
                        showMoreLabel={showMoreLabel}
                        showLessLabel={showLessLabel}
                        className="text-sm text-copy-muted"
                      />
                    )}
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </SplitList>
      ) : (
        <p className="text-sm text-copy-muted">{list === null ? unavailableText : emptyText}</p>
      )}
    </SplitColumn>
  );
}
